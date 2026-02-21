#!/usr/bin/env python3
"""
Parse a Python/pandas script and output a JSON pipeline of Convoy steps.
Reads source from stdin, writes JSON to stdout.
Used by the Convoy server for "Import from Python"; falls back to LLM when
fallbackToLlm is true or parsing fails.
"""
import ast
import json
import sys
from typing import Any, List, Optional


# Convoy operator names
FILTER_OPS = {
    ast.Eq: "eq",
    ast.NotEq: "neq",
    ast.Lt: "lt",
    ast.LtE: "lt",  # <= maps to lt for simplicity; could add lte
    ast.Gt: "gt",
    ast.GtE: "gt",
}


def get_constant_value(node: ast.AST) -> Any:
    """Extract a constant or simple literal from an AST node."""
    if isinstance(node, ast.Constant):
        return node.value
    if hasattr(ast, "Num") and isinstance(node, ast.Num):
        return node.n
    if hasattr(ast, "Str") and isinstance(node, ast.Str):
        return node.s
    if hasattr(ast, "NameConstant") and isinstance(node, ast.NameConstant):
        return node.value
    return None


def get_string_from_node(node: ast.AST) -> Optional[str]:
    """Get a string value from a node (Constant, or Subscript like df['col'])."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if hasattr(ast, "Str") and isinstance(node, ast.Str):
        return node.s
    if isinstance(node, ast.Subscript):
        return get_string_from_node(node.slice)
    if isinstance(node, ast.Index):
        return get_string_from_node(node.value)
    if hasattr(ast, "Constant") and isinstance(node, ast.Constant):
        if isinstance(node.value, str):
            return node.value
    return None


def get_column_list(node: ast.AST) -> Optional[List[str]]:
    """Extract list of column names from df[['a','b']] style."""
    if isinstance(node, ast.Subscript):
        slc = node.slice
        if hasattr(slc, "value"):
            slc = slc.value  # unwrap Index
        if isinstance(slc, (ast.Tuple, ast.List)):
            elts = slc.elts
        elif hasattr(slc, "elts"):
            elts = slc.elts
        else:
            return None
        cols = []
        for e in elts:
            s = get_string_from_node(e)
            if s is not None:
                cols.append(s)
        return cols if cols else None
    return None


def unparse_simple(node: ast.AST, source_lines: List[str]) -> str:
    """Rough unparse for an expression using source lines (best effort)."""
    if hasattr(node, "lineno") and hasattr(node, "end_lineno"):
        try:
            start = node.lineno - 1
            end = node.end_lineno or node.lineno
            return " ".join(source_lines[start:end]).strip()
        except Exception:
            pass
    return ""


class PipelineExtractor(ast.NodeVisitor):
    def __init__(self, source: str):
        self.source = source
        self.lines = source.splitlines()
        self.steps: List[dict] = []
        self.fallback_to_llm = False
        self.df_name = "df"

    def _add_step(self, kind: str, config: dict) -> None:
        self.steps.append({"kind": kind, "config": config})

    def visit_Assign(self, node: ast.Assign) -> None:
        if len(node.targets) != 1:
            self.generic_visit(node)
            return
        target = node.targets[0]
        value = node.value

        # df = df[df["col"] op value]  (filter) or df = df[["a","b"]]  (select)
        if isinstance(value, ast.Subscript):
            slice_val = value.slice
            if hasattr(slice_val, "value"):
                slice_val = getattr(slice_val, "value", slice_val)  # unwrap Index
            if isinstance(slice_val, ast.Compare) and len(slice_val.comparators) == 1:
                left = slice_val.left
                op = type(slice_val.ops[0])
                right = slice_val.comparators[0]
                col = get_string_from_node(left)
                if col and op in FILTER_OPS:
                    convoy_op = FILTER_OPS[op]
                    val = get_constant_value(right)
                    if val is not None:
                        self._add_step(
                            "filter",
                            {"column": col, "operator": convoy_op, "value": str(val)},
                        )
                        return
            list_cols = get_column_list(value)
            if list_cols is not None:
                self._add_step("select", {"columns": list_cols})
                return

        # df = pd.read_csv(...) or pandas.read_csv(...)
        if isinstance(value, ast.Call):
            func = value.func
            if isinstance(func, ast.Attribute):
                if func.attr == "read_csv":
                    name = None
                    if isinstance(func.value, ast.Name):
                        name = func.value.id
                    if name in ("pd", "pandas"):
                        fname = ""
                        if value.args:
                            arg0 = value.args[0]
                            s = get_string_from_node(arg0)
                            if s:
                                fname = s
                        self._add_step("dataSource", {"fileName": fname or "data.csv"})
                        return
            # df = df.groupby(...)
            if isinstance(func, ast.Attribute) and func.attr == "groupby":
                if value.args and isinstance(value.args[0], ast.Constant):
                    group_col = value.args[0].value
                else:
                    group_col = get_string_from_node(value.args[0]) if value.args else ""
                # chain: .sum(), .mean(), .count(), etc. then .reset_index()
                agg_col = group_col
                agg = "count"
                # look at parent: usually df.groupby("x")["y"].sum().reset_index()
                if isinstance(func.value, ast.Subscript):
                    agg_col = get_string_from_node(func.value.slice) or group_col
                # method might be on a different chained call
                for keyword in value.keywords:
                    if keyword.arg == "by":
                        g = get_string_from_node(keyword.value)
                        if g:
                            group_col = g
                self._add_step(
                    "groupBy",
                    {
                        "groupByColumn": group_col,
                        "aggregateColumn": agg_col,
                        "aggregation": agg,
                    },
                )
                return
            # .sum(), .mean(), .count() etc. after groupby (chained)
            if isinstance(func, ast.Attribute):
                agg_method = func.attr
                if agg_method in ("sum", "mean", "count", "min", "max"):
                    # value.func.value might be groupby(...)["col"] or groupby(...)
                    prev = getattr(value.func, "value", None)
                    group_col = ""
                    agg_col = ""
                    while prev:
                        if isinstance(prev, ast.Call) and getattr(prev.func, "attr", None) == "groupby":
                            if prev.args:
                                group_col = get_string_from_node(prev.args[0]) or ""
                            break
                        if isinstance(prev, ast.Subscript):
                            agg_col = get_string_from_node(prev.slice) or group_col
                        prev = getattr(prev, "value", None)
                    if agg_method == "mean":
                        agg_method = "avg"
                    self._add_step(
                        "groupBy",
                        {
                            "groupByColumn": group_col,
                            "aggregateColumn": agg_col or group_col,
                            "aggregation": agg_method,
                        },
                    )
                    return

            # df = df.sort_values(...)
            if isinstance(func, ast.Attribute) and func.attr == "sort_values":
                col = ""
                ascending = True
                if value.args:
                    col = get_string_from_node(value.args[0]) or ""
                for kw in value.keywords:
                    if kw.arg == "by":
                        c = get_string_from_node(kw.value)
                        if c:
                            col = c
                    if kw.arg == "ascending":
                        v = get_constant_value(kw.value)
                        if v is not None:
                            ascending = bool(v)
                self._add_step(
                    "sort",
                    {"column": col, "direction": "asc" if ascending else "desc"},
                )
                return

            # df.melt(...)
            if isinstance(func, ast.Attribute) and func.attr == "melt":
                id_vars = []
                value_vars = []
                value_name = "value"
                var_name = "variable"
                for kw in value.keywords:
                    if kw.arg == "id_vars":
                        if isinstance(kw.value, (ast.List, ast.Tuple)):
                            for e in kw.value.elts:
                                s = get_string_from_node(e)
                                if s:
                                    id_vars.append(s)
                        else:
                            s = get_string_from_node(kw.value)
                            if s:
                                id_vars.append(s)
                    elif kw.arg == "value_vars":
                        if isinstance(kw.value, (ast.List, ast.Tuple)):
                            for e in kw.value.elts:
                                s = get_string_from_node(e)
                                if s:
                                    value_vars.append(s)
                    elif kw.arg == "value_name":
                        value_name = get_string_from_node(kw.value) or value_name
                    elif kw.arg == "var_name":
                        var_name = get_string_from_node(kw.value) or var_name
                if value_vars:
                    self._add_step(
                        "reshape",
                        {
                            "keyColumn": var_name,
                            "valueColumn": value_name,
                            "pivotColumns": value_vars,
                        },
                    )
                    return

        # df["new_col"] = expression  (computed column)
        if isinstance(target, ast.Subscript):
            col_name = get_string_from_node(target)
            if col_name is not None:
                expr_str = unparse_simple(node.value, self.lines)
                if expr_str:
                    self._add_step(
                        "computedColumn",
                        {"newColumnName": col_name, "expression": expr_str},
                    )
                    return
                self.fallback_to_llm = True

        # Unrecognized assignment to df
        if isinstance(target, ast.Name) and target.id == self.df_name:
            self.fallback_to_llm = True

        self.generic_visit(node)

    def visit_Expr(self, node: ast.Expr) -> None:
        # plt.bar(df["x"], df["y"]), plt.plot, plt.scatter, plt.pie
        if isinstance(node.value, ast.Call):
            call = node.value
            func = call.func
            if isinstance(func, ast.Attribute):
                if isinstance(func.value, ast.Attribute):
                    if getattr(func.value, "attr", None) == "pyplot" or (
                        isinstance(func.value, ast.Name) and func.value.id == "plt"
                    ):
                        chart_attr = func.attr
                        x_axis = ""
                        y_axis = ""
                        if chart_attr in ("bar", "plot", "scatter", "pie"):
                            chart_type = "bar"
                            if chart_attr == "plot":
                                chart_type = "line"
                            elif chart_attr == "scatter":
                                chart_type = "scatter"
                            elif chart_attr == "pie":
                                chart_type = "pie"
                            if call.args:
                                if len(call.args) >= 2:
                                    # plt.bar(x, y) -> x might be df["col"]
                                    x_axis = get_string_from_node(call.args[0]) or ""
                                    y_axis = get_string_from_node(call.args[1]) or ""
                                elif len(call.args) == 1:
                                    y_axis = get_string_from_node(call.args[0]) or ""
                            self._add_step("chart", {"chartType": chart_type, "xAxis": x_axis, "yAxis": y_axis})
                            return
        self.generic_visit(node)


def main() -> None:
    source = sys.stdin.read()
    try:
        tree = ast.parse(source)
    except SyntaxError:
        print(json.dumps({"steps": [], "fallbackToLlm": True}))
        return

    extractor = PipelineExtractor(source)
    try:
        extractor.visit(tree)
    except Exception:
        print(json.dumps({"steps": [], "fallbackToLlm": True}))
        return

    # Convert steps to Convoy format: kind -> type, config stays
    nodes = [{"type": s["kind"], "config": s["config"]} for s in extractor.steps]
    result = {
        "steps": nodes,
        "fallbackToLlm": extractor.fallback_to_llm or len(extractor.steps) == 0,
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
