/**
 * Code generators that produce Jupyter-valid Python (pandas) from node configurations.
 * Used by CodeView in nodes and can be used for pipeline export.
 * All node types use Python; variable name for the active dataframe is "df".
 */

const PYTHON_NODE_TYPES = new Set([
  'filter',
  'groupBy',
  'sort',
  'select',
  'transform',
  'chart',
  'dataSource',
  'computedColumn',
  'reshape',
]);

/**
 * Returns the Monaco editor language for a given node type.
 */
export function getEditorLanguage(nodeType: string): string {
  return PYTHON_NODE_TYPES.has(nodeType) ? 'python' : 'python';
}

export function generateNodeCode(
  nodeType: string,
  config: Record<string, unknown>
): string {
  switch (nodeType) {
    case 'filter':
      return generateFilterCode(config);
    case 'groupBy':
      return generateGroupByCode(config);
    case 'sort':
      return generateSortCode(config);
    case 'select':
      return generateSelectCode(config);
    case 'transform':
      return generateTransformCode(config);
    case 'chart':
      return generateChartCode(config);
    case 'dataSource':
      return generateDataSourceCode(config);
    case 'computedColumn':
      return generateComputedColumnCode(config);
    case 'reshape':
      return generateReshapeCode(config);
    default:
      return `# Unknown node type: ${nodeType}\n# Configure the node to generate code`;
  }
}

// ─── Python (pandas) generators ─────────────────────────────────────────────

/** Escape a string for use inside double-quoted Python string literal (backslash and quote). */
function pyEscape(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const FILTER_PLACEHOLDER = `# Filter node — configure column, condition, and value to generate code
# df = df[<condition>]`;

function generateFilterCode(config: Record<string, unknown>): string {
  const { column, operator, value } = config;

  if (!column || !operator) {
    return `# Filter node — configure column and condition to generate code
# df = df[<condition>]`;
  }

  // For comparison and string ops, value is required (empty value produces invalid code e.g. int64 vs str)
  const valueStr = value !== undefined && value !== null ? String(value).trim() : '';
  const needValue = ['eq', 'neq', 'gt', 'lt', 'contains', 'startsWith'].includes(operator as string);
  if (needValue && valueStr === '') {
    return FILTER_PLACEHOLDER;
  }

  const colStr = typeof column === 'string' ? column : String(column ?? '');
  const colEscaped = pyEscape(colStr);

  const numValue = Number(value);
  const isNumeric = valueStr !== '' && !isNaN(numValue);
  const opMap: Record<string, string> = {
    eq: '==',
    neq: '!=',
    gt: '>',
    lt: '<',
  };

  if (operator === 'contains') {
    return `df = df[df["${colEscaped}"].str.contains("${pyEscape(valueStr)}", case=False, na=False)]`;
  }
  if (operator === 'startsWith') {
    return `df = df[df["${colEscaped}"].str.startswith("${pyEscape(valueStr)}", na=False)]`;
  }
  const op = opMap[operator as string] || '==';
  const fmtVal = isNumeric ? String(numValue) : `"${pyEscape(valueStr)}"`;
  return `df = df[df["${colEscaped}"] ${op} ${fmtVal}]`;
}

function generateGroupByCode(config: Record<string, unknown>): string {
  const { groupByColumn, aggregateColumn, aggregation } = config;

  if (!groupByColumn || !aggregation) {
    return `# Group By node — configure grouping to generate code
# df = df.groupby("column").agg(...).reset_index()`;
  }

  const aggCol = (aggregateColumn as string) || groupByColumn;
  const pandasAgg = aggregation === 'avg' ? 'mean' : (aggregation as string);
  return `df = df.groupby("${groupByColumn}")["${aggCol}"].${pandasAgg}().reset_index()`;
}

function generateSortCode(config: Record<string, unknown>): string {
  const { column, direction } = config;

  if (!column) {
    return `# Sort node — select a column to generate code
# df = df.sort_values("column", ascending=True)`;
  }

  const ascending = direction !== 'desc';
  return `df = df.sort_values("${column}", ascending=${ascending ? 'True' : 'False'})`;
}

function generateSelectCode(config: Record<string, unknown>): string {
  const { columns: selectedColumns } = config as { columns?: string[] };

  if (!selectedColumns || selectedColumns.length === 0) {
    return `# Select Columns node — choose columns to keep
# df = df[["col1", "col2"]]`;
  }

  const cols = selectedColumns.map((c) => JSON.stringify(c)).join(', ');
  return `df = df[[${cols}]]`;
}

function generateTransformCode(config: Record<string, unknown>): string {
  const { customCode } = config;
  if (customCode && typeof customCode === 'string') {
    return customCode;
  }
  return `# Custom transform — input dataframe is in 'df'
# Modify df in place or reassign: df = ...
# Example: df = df.assign(new_col=df["a"] + df["b"])`;
}

function generateComputedColumnCode(config: Record<string, unknown>): string {
  const { newColumnName, expression } = config;

  if (!newColumnName || !expression) {
    return `# Computed Column — configure a name and expression
# df["new_col"] = <expression>`;
  }

  return `df["${newColumnName}"] = ${expression}`;
}

function generateReshapeCode(config: Record<string, unknown>): string {
  const { keyColumn, valueColumn, pivotColumns } = config as {
    keyColumn?: string;
    valueColumn?: string;
    pivotColumns?: string[];
  };

  if (!keyColumn || !valueColumn || !pivotColumns || pivotColumns.length === 0) {
    return `# Reshape — unpivot wide to long
# df = pd.melt(df, id_vars=[...], value_vars=[...], var_name="...", value_name="...")`;
  }

  const pivotList = pivotColumns.map((c) => JSON.stringify(c)).join(', ');
  return `df = pd.melt(df, id_vars=[c for c in df.columns if c not in [${pivotList}]], value_vars=[${pivotList}], var_name="${keyColumn}", value_name="${valueColumn}")`;
}

function generateChartCode(config: Record<string, unknown>): string {
  const { chartType, xAxis, yAxis } = config;

  if (!xAxis || !yAxis) {
    return `# Chart node — configure axes to generate matplotlib code`;
  }

  const type = (chartType as string) || 'bar';

  switch (type) {
    case 'bar':
      return `import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.bar(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()`;
    case 'line':
      return `import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.plot(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()`;
    case 'scatter':
      return `import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.scatter(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()`;
    case 'pie':
      return `import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.pie(df["${yAxis}"], labels=df["${xAxis}"], autopct="%1.1f%%")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()`;
    case 'area':
      return `import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.fill_between(range(len(df)), df["${yAxis}"], alpha=0.3)
plt.plot(range(len(df)), df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()`;
    default:
      return `import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.bar(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()`;
  }
}

function generateDataSourceCode(config: Record<string, unknown>): string {
  const { fileName } = config;

  if (!fileName) {
    return `# Data Source — set a file path or paste data
# df = pd.read_csv("your-file.csv")
df = pd.DataFrame()`;
  }

  return `df = pd.read_csv(${JSON.stringify(fileName)})
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")`;
}
