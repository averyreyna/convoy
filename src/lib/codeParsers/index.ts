/**
 * Inverse of `@/lib/codeGenerators`: parse a single generated pandas snippet back
 * into structured node config. This is what makes the node ⇆ cell relationship
 * bidirectional — editing a cell's code can update the structured node directly,
 * without a server round-trip, as long as the code still matches the shape the
 * generator produces.
 *
 * Contract: `parseNodeCode(type, generateNodeCode(type, config))` recovers `config`
 * for every structured node type (round-trip tested in tests/lib/codeParsers.test.ts).
 *
 * Returns `null` when the code does not match the generated shape for that node
 * type — i.e. the user wrote something free-form. Callers should treat `null` as
 * "this is opaque custom code" and keep it as `customCode` rather than forcing it
 * into structured fields (the escape hatch). Multi-statement / multi-line code
 * never parses here by design: a pure structured node is exactly one statement.
 */

/** Node types this parser can invert. Mirrors the structured generators. */
export const PARSEABLE_NODE_TYPES = new Set([
  'filter',
  'sort',
  'select',
  'groupBy',
  'computedColumn',
  'reshape',
]);

export function isParseable(nodeType: string): boolean {
  return PARSEABLE_NODE_TYPES.has(nodeType);
}

/**
 * Parse generated pandas code back into the config for `nodeType`.
 * Returns a partial config (the structured keys for that type) or null if the
 * code is not in the generated shape (including placeholders and free-form code).
 */
export function parseNodeCode(
  nodeType: string,
  code: string
): Record<string, unknown> | null {
  const line = code.trim();
  // Placeholders are comments; never treat them as structured config.
  if (line === '' || line.startsWith('#')) return null;

  switch (nodeType) {
    case 'filter':
      return parseFilter(line);
    case 'sort':
      return parseSort(line);
    case 'select':
      return parseSelect(line);
    case 'groupBy':
      return parseGroupBy(line);
    case 'computedColumn':
      return parseComputedColumn(line);
    case 'reshape':
      return parseReshape(line);
    default:
      return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Reverse of pyEscape in codeGenerators: unescape \\ and \" in a string literal body. */
function pyUnescape(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === '\\' || next === '"') {
        out += next;
        i++;
        continue;
      }
    }
    out += s[i];
  }
  return out;
}

/** Parse a JSON-style list body (e.g. `"a", "b"`) into string[]. Null on malformed. */
function parseStringList(body: string): string[] | null {
  try {
    const parsed = JSON.parse(`[${body}]`);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[];
    }
  } catch {
    // fall through
  }
  return null;
}

// ─── Per-type parsers (exact inverses of the generators) ────────────────────

const FILTER_OP_FROM_SYMBOL: Record<string, string> = {
  '==': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
};

function parseFilter(line: string): Record<string, unknown> | null {
  // df = df[df["COL"].str.contains("VAL", case=False, na=False)]
  const contains = line.match(
    /^df = df\[df\["(.*?)"\]\.str\.contains\("(.*)", case=False, na=False\)\]$/
  );
  if (contains) {
    return {
      column: pyUnescape(contains[1]),
      operator: 'contains',
      value: pyUnescape(contains[2]),
    };
  }

  // df = df[df["COL"].str.startswith("VAL", na=False)]
  const startsWith = line.match(
    /^df = df\[df\["(.*?)"\]\.str\.startswith\("(.*)", na=False\)\]$/
  );
  if (startsWith) {
    return {
      column: pyUnescape(startsWith[1]),
      operator: 'startsWith',
      value: pyUnescape(startsWith[2]),
    };
  }

  // df = df[df["COL"] <op> <value>]  where value is "string" or bare number
  const cmp = line.match(/^df = df\[df\["(.*?)"\] (==|!=|>|<) (.+)\]$/);
  if (cmp) {
    const operator = FILTER_OP_FROM_SYMBOL[cmp[2]];
    if (!operator) return null;
    const rhs = cmp[3];
    const quoted = rhs.match(/^"(.*)"$/);
    const value = quoted ? pyUnescape(quoted[1]) : rhs;
    return { column: pyUnescape(cmp[1]), operator, value };
  }

  return null;
}

function parseSort(line: string): Record<string, unknown> | null {
  // df = df.sort_values("COL", ascending=True|False)
  const m = line.match(/^df = df\.sort_values\("(.*)", ascending=(True|False)\)$/);
  if (!m) return null;
  return { column: m[1], direction: m[2] === 'True' ? 'asc' : 'desc' };
}

function parseSelect(line: string): Record<string, unknown> | null {
  // df = df[["col1", "col2"]]
  const m = line.match(/^df = df\[\[(.*)\]\]$/);
  if (!m) return null;
  const columns = parseStringList(m[1]);
  if (!columns || columns.length === 0) return null;
  return { columns };
}

const GROUPBY_AGG_FROM_PANDAS: Record<string, string> = {
  count: 'count',
  sum: 'sum',
  mean: 'avg',
  min: 'min',
  max: 'max',
};

function parseGroupBy(line: string): Record<string, unknown> | null {
  // df = df.groupby("GB")["AGG"].<agg>().reset_index()
  const m = line.match(
    /^df = df\.groupby\("(.*)"\)\["(.*)"\]\.(\w+)\(\)\.reset_index\(\)$/
  );
  if (!m) return null;
  const aggregation = GROUPBY_AGG_FROM_PANDAS[m[3]];
  if (!aggregation) return null;
  return {
    groupByColumn: m[1],
    aggregateColumn: m[2],
    aggregation,
  };
}

function parseComputedColumn(line: string): Record<string, unknown> | null {
  // df["NAME"] = EXPRESSION
  const m = line.match(/^df\["(.*)"\] = (.+)$/);
  if (!m) return null;
  return { newColumnName: m[1], expression: m[2].trim() };
}

function parseReshape(line: string): Record<string, unknown> | null {
  // df = pd.melt(df, id_vars=[c for c in df.columns if c not in [<list>]],
  //              value_vars=[<list>], var_name="KEY", value_name="VALUE")
  const m = line.match(
    /^df = pd\.melt\(df, id_vars=\[c for c in df\.columns if c not in \[(.*?)\]\], value_vars=\[(.*?)\], var_name="(.*)", value_name="(.*)"\)$/
  );
  if (!m) return null;
  const pivotColumns = parseStringList(m[2]);
  if (!pivotColumns || pivotColumns.length === 0) return null;
  return {
    keyColumn: m[3],
    valueColumn: m[4],
    pivotColumns,
  };
}
