/**
 * Static schema semantics for a single pipeline step — the "type system" behind
 * the node ⇆ cell duality, in the spirit of Hazel's typed holes.
 *
 * Convoy's type system is the DataFrame schema (columns + dtypes) flowing along
 * the lineage. This module is its static semantics: given the input schema and a
 * step (a structured node config, or a parsed code cell), it computes
 *   1. the output schema the step produces (fed to the next step), and
 *   2. diagnostics — references to columns that don't exist, dtype mismatches —
 *      so errors can be surfaced as the user types instead of after a run.
 *
 * Gradual rule (from gradual type theory, which Hazel borrows from): a schema is
 * either `known` (a concrete column list) or `unknown` (the gradual `?`). Opaque
 * code whose effect can't be analysed produces `unknown`, and `unknown`
 * propagates downstream while *suppressing* column-existence diagnostics — so an
 * un-analysable cell degrades gracefully instead of producing false errors. Only
 * a dataSource (which establishes a fresh schema) recovers `known` from
 * `unknown`.
 *
 * This is editor-agnostic on purpose: it's pure functions over (schema, step),
 * unit-tested independently, so completion/marker rendering can be built on top
 * later against whichever editor we land on.
 */
import type { Column } from '@/types';
import { parseNodeCode, isParseable } from '@/lib/codeParsers';

export type ColumnType = Column['type'];

/** A schema is a concrete set of columns, or unknown (the gradual `?`). */
export type Schema =
  | { kind: 'known'; columns: Column[] }
  | { kind: 'unknown' };

export type DiagnosticSeverity = 'error' | 'warning';

export interface SchemaDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  /** The column the diagnostic concerns, when applicable (for UI surfacing). */
  column?: string;
}

export interface SchemaInference {
  outputSchema: Schema;
  diagnostics: SchemaDiagnostic[];
}

/** A structured pipeline step: a node type plus its config. */
export interface Step {
  type: string;
  config: Record<string, unknown>;
}

// ─── Constructors / helpers ─────────────────────────────────────────────────

export const knownSchema = (columns: Column[]): Schema => ({ kind: 'known', columns });
export const unknownSchema: Schema = { kind: 'unknown' };

const passthrough = (input: Schema): SchemaInference => ({
  outputSchema: input,
  diagnostics: [],
});

const findColumn = (schema: Schema, name: string): Column | undefined =>
  schema.kind === 'known' ? schema.columns.find((c) => c.name === name) : undefined;

/** Diagnostic for a column referenced by a step that isn't in the input schema. */
const missingColumn = (name: string): SchemaDiagnostic => ({
  severity: 'error',
  message: `Column "${name}" does not exist in the input data`,
  column: name,
});

/** Column names referenced as df["..."] inside a free-form expression. */
const columnRefsInExpression = (expr: string): string[] => {
  const refs: string[] = [];
  const re = /df\[["'](.*?)["']\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) refs.push(m[1]);
  return refs;
};

/** Whether an expression looks arithmetic (used to guess a computed column's dtype). */
const looksArithmetic = (expr: string): boolean => /[+\-*/]|\.sum\(|\.mean\(|\.abs\(/.test(expr);

// ─── Public entry points ────────────────────────────────────────────────────

/**
 * Infer the output schema and diagnostics for a structured step. This is the
 * precise path: callers that already have a node's type + config (every node in
 * the lineage) should use it rather than round-tripping through generated code.
 */
export function inferSchema(input: Schema, step: Step): SchemaInference {
  switch (step.type) {
    case 'dataSource':
      return inferDataSource(step.config);
    case 'filter':
      return inferFilter(input, step.config);
    case 'sort':
      return inferSort(input, step.config);
    case 'select':
      return inferSelect(input, step.config);
    case 'groupBy':
      return inferGroupBy(input, step.config);
    case 'computedColumn':
      return inferComputedColumn(input, step.config);
    case 'reshape':
      return inferReshape(input, step.config);
    case 'chart':
      // Charts read the frame but don't transform it; only axis refs are checked.
      return inferChart(input, step.config);
    default:
      // transform, aiCleanData, anything opaque: effect on schema is unknown.
      return { outputSchema: unknownSchema, diagnostics: [] };
  }
}

/**
 * Infer from a raw code cell — the code-first path. Parses the cell back to a
 * structured step (reusing the codeParsers inverse) and defers to `inferSchema`.
 *
 * - Empty / comment-only cell → a hole: passes the schema through, no diagnostics.
 * - Parses to a structured step → precise inference.
 * - Opaque (free-form) code → `unknown` output, no diagnostics (gradual `?`).
 *
 * `knownType` (the node's type, when the cell is node-backed) restricts parsing
 * to that one shape; without it the cell is classified against every parseable
 * type, first match wins.
 */
export function inferSchemaFromCode(
  input: Schema,
  code: string,
  knownType?: string
): SchemaInference {
  const trimmed = code.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return passthrough(input);

  if (knownType) {
    const config = parseNodeCode(knownType, code);
    if (config) return inferSchema(input, { type: knownType, config });
    // Node-backed cell whose code no longer matches its generated shape: opaque.
    return { outputSchema: unknownSchema, diagnostics: [] };
  }

  const classified = classifyCell(code);
  if (classified) return inferSchema(input, classified);
  return { outputSchema: unknownSchema, diagnostics: [] };
}

/**
 * Try to recognise a free code cell as a structured step by inverting it against
 * every parseable node type. Returns the first match, or null for opaque code.
 * (Multi-statement cells never match — a structured step is one statement.)
 */
export function classifyCell(code: string): Step | null {
  for (const type of ['filter', 'sort', 'select', 'groupBy', 'computedColumn', 'reshape']) {
    if (!isParseable(type)) continue;
    const config = parseNodeCode(type, code);
    if (config) return { type, config };
  }
  return null;
}

// ─── Per-type inference ─────────────────────────────────────────────────────

function inferDataSource(config: Record<string, unknown>): SchemaInference {
  const columns = config.columns;
  if (Array.isArray(columns) && columns.every(isColumn)) {
    return { outputSchema: knownSchema(columns), diagnostics: [] };
  }
  // Code-first data source (pd.read_csv) with no declared columns: unknown.
  return { outputSchema: unknownSchema, diagnostics: [] };
}

function inferFilter(input: Schema, config: Record<string, unknown>): SchemaInference {
  // Schema-preserving; only the referenced column / dtype are checked.
  const column = config.column as string | undefined;
  const operator = config.operator as string | undefined;
  const diagnostics: SchemaDiagnostic[] = [];
  if (column && input.kind === 'known') {
    const col = findColumn(input, column);
    if (!col) {
      diagnostics.push(missingColumn(column));
    } else if (operator) {
      if ((operator === 'gt' || operator === 'lt') && col.type !== 'number' && col.type !== 'date') {
        diagnostics.push({
          severity: 'warning',
          message: `"${column}" is ${col.type}; ordering with ${operator === 'gt' ? '>' : '<'} may not behave as expected`,
          column,
        });
      }
      if ((operator === 'contains' || operator === 'startsWith') && col.type !== 'string') {
        diagnostics.push({
          severity: 'warning',
          message: `"${operator}" expects a string column, but "${column}" is ${col.type}`,
          column,
        });
      }
    }
  }
  return { outputSchema: input, diagnostics };
}

function inferSort(input: Schema, config: Record<string, unknown>): SchemaInference {
  const column = config.column as string | undefined;
  const diagnostics: SchemaDiagnostic[] = [];
  if (column && input.kind === 'known' && !findColumn(input, column)) {
    diagnostics.push(missingColumn(column));
  }
  return { outputSchema: input, diagnostics };
}

function inferSelect(input: Schema, config: Record<string, unknown>): SchemaInference {
  const columns = config.columns as string[] | undefined;
  if (!columns || columns.length === 0) return passthrough(input);
  if (input.kind !== 'known') return { outputSchema: unknownSchema, diagnostics: [] };

  const diagnostics: SchemaDiagnostic[] = [];
  const kept: Column[] = [];
  for (const name of columns) {
    const col = findColumn(input, name);
    if (col) kept.push(col);
    else diagnostics.push(missingColumn(name));
  }
  return { outputSchema: knownSchema(kept), diagnostics };
}

function inferGroupBy(input: Schema, config: Record<string, unknown>): SchemaInference {
  const groupByColumn = config.groupByColumn as string | undefined;
  const aggregateColumn = config.aggregateColumn as string | undefined;
  const aggregation = config.aggregation as string | undefined;
  if (!groupByColumn || !aggregation) return passthrough(input);
  if (input.kind !== 'known') return { outputSchema: unknownSchema, diagnostics: [] };

  const diagnostics: SchemaDiagnostic[] = [];
  const gbCol = findColumn(input, groupByColumn);
  if (!gbCol) diagnostics.push(missingColumn(groupByColumn));

  // Generator falls back to the group column when no aggregate column is set.
  const aggName = aggregateColumn || groupByColumn;
  const aggCol = findColumn(input, aggName);
  if (!aggCol) diagnostics.push(missingColumn(aggName));
  else if ((aggregation === 'sum' || aggregation === 'avg') && aggCol.type !== 'number') {
    diagnostics.push({
      severity: 'warning',
      message: `${aggregation} aggregation expects a numeric column, but "${aggName}" is ${aggCol.type}`,
      column: aggName,
    });
  }

  // Output of df.groupby(GB)[AGG].<agg>().reset_index() is exactly [GB, AGG].
  const resultType: ColumnType =
    aggregation === 'count' || aggregation === 'sum' || aggregation === 'avg'
      ? 'number'
      : (aggCol?.type ?? 'number');
  const outColumns: Column[] = [
    { name: groupByColumn, type: gbCol?.type ?? 'string' },
    { name: aggName, type: resultType },
  ];
  return { outputSchema: knownSchema(outColumns), diagnostics };
}

function inferComputedColumn(input: Schema, config: Record<string, unknown>): SchemaInference {
  const newColumnName = config.newColumnName as string | undefined;
  const expression = config.expression as string | undefined;
  if (!newColumnName || !expression) return passthrough(input);

  const diagnostics: SchemaDiagnostic[] = [];
  if (input.kind === 'known') {
    for (const ref of columnRefsInExpression(expression)) {
      if (!findColumn(input, ref)) diagnostics.push(missingColumn(ref));
    }
  }

  const newType: ColumnType = looksArithmetic(expression) ? 'number' : 'string';
  if (input.kind !== 'known') {
    // Can't enumerate output columns without a base schema; stays gradual.
    return { outputSchema: unknownSchema, diagnostics };
  }
  // Re-binding an existing column replaces it; otherwise append.
  const columns = input.columns.some((c) => c.name === newColumnName)
    ? input.columns.map((c) => (c.name === newColumnName ? { name: newColumnName, type: newType } : c))
    : [...input.columns, { name: newColumnName, type: newType }];
  return { outputSchema: knownSchema(columns), diagnostics };
}

function inferReshape(input: Schema, config: Record<string, unknown>): SchemaInference {
  const keyColumn = config.keyColumn as string | undefined;
  const valueColumn = config.valueColumn as string | undefined;
  const pivotColumns = config.pivotColumns as string[] | undefined;
  if (!keyColumn || !valueColumn || !pivotColumns || pivotColumns.length === 0) {
    return passthrough(input);
  }
  if (input.kind !== 'known') return { outputSchema: unknownSchema, diagnostics: [] };

  const diagnostics: SchemaDiagnostic[] = [];
  const pivotSet = new Set(pivotColumns);
  for (const name of pivotColumns) {
    if (!findColumn(input, name)) diagnostics.push(missingColumn(name));
  }

  // melt: id_vars (everything not pivoted) are retained; the pivoted columns
  // collapse into [keyColumn (their former names), valueColumn (their values)].
  const idVars = input.columns.filter((c) => !pivotSet.has(c.name));
  const pivotCols = input.columns.filter((c) => pivotSet.has(c.name));
  const valueType: ColumnType =
    pivotCols.length > 0 && pivotCols.every((c) => c.type === pivotCols[0].type)
      ? pivotCols[0].type
      : 'string';
  const outColumns: Column[] = [
    ...idVars,
    { name: keyColumn, type: 'string' },
    { name: valueColumn, type: valueType },
  ];
  return { outputSchema: knownSchema(outColumns), diagnostics };
}

function inferChart(input: Schema, config: Record<string, unknown>): SchemaInference {
  const diagnostics: SchemaDiagnostic[] = [];
  if (input.kind === 'known') {
    for (const axis of ['xAxis', 'yAxis'] as const) {
      const name = config[axis] as string | undefined;
      if (name && !findColumn(input, name)) diagnostics.push(missingColumn(name));
    }
  }
  return { outputSchema: input, diagnostics };
}

// ─── Lineage threading ──────────────────────────────────────────────────────

/** One step's inference plus the input schema it saw (for per-cell surfacing). */
export interface LineageSchemaStep {
  inputSchema: Schema;
  outputSchema: Schema;
  diagnostics: SchemaDiagnostic[];
}

/**
 * Thread schema inference down a linear lineage (root → leaf), the same shape
 * the panel already walks for `df` and row counts. Each step sees its
 * predecessor's output as its input; the first step starts from `rootSchema`
 * (typically the data source's columns, or `unknownSchema`).
 */
export function inferLineageSchemas(steps: Step[], rootSchema: Schema = unknownSchema): LineageSchemaStep[] {
  const result: LineageSchemaStep[] = [];
  let current = rootSchema;
  for (const step of steps) {
    const { outputSchema, diagnostics } = inferSchema(current, step);
    result.push({ inputSchema: current, outputSchema, diagnostics });
    current = outputSchema;
  }
  return result;
}

// ─── Internal ───────────────────────────────────────────────────────────────

function isColumn(x: unknown): x is Column {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as Column).name === 'string' &&
    typeof (x as Column).type === 'string'
  );
}
