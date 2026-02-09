import type { Node, Edge } from '@xyflow/react';
import { generateNodeCode } from './codeGenerators';

/**
 * Walk the node graph in topological order (DataSource → ... → Chart)
 * and return the ordered list of nodes.
 */
function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  // Build adjacency list and in-degree map
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return sorted.map((id) => nodeMap.get(id)!).filter(Boolean);
}

/**
 * Get the generated or custom code for a node.
 */
function getNodeCode(node: Node): { code: string; nodeType: string; label: string } {
  const data = node.data as Record<string, unknown>;
  const nodeType = node.type || 'unknown';
  const label = (data.label as string) || nodeType;

  if (data.customCode && typeof data.customCode === 'string') {
    return { code: data.customCode, nodeType, label };
  }

  // Build config from data (strip internal fields)
  const config = { ...data };
  delete config.state;
  delete config.label;
  delete config.isCodeMode;
  delete config.customCode;
  delete config.error;
  delete config.inputRowCount;
  delete config.outputRowCount;

  const code = generateNodeCode(nodeType, config);
  return { code, nodeType, label };
}

// ─── JavaScript Export ──────────────────────────────────────────────────────

/**
 * Build a mapping from node IDs to clean variable names.
 * The first data variable is "data"; subsequent transformations get
 * descriptive names like "filtered", "grouped", "sorted", etc.
 */
function buildVariableNames(sorted: Node[]): Map<string, string> {
  const varMap = new Map<string, string>();
  const usedNames = new Set<string>();

  function uniqueName(base: string): string {
    if (!usedNames.has(base)) {
      usedNames.add(base);
      return base;
    }
    let i = 2;
    while (usedNames.has(`${base}${i}`)) i++;
    usedNames.add(`${base}${i}`);
    return `${base}${i}`;
  }

  for (const node of sorted) {
    const nodeType = node.type || 'unknown';
    switch (nodeType) {
      case 'dataSource':
        varMap.set(node.id, uniqueName('data'));
        break;
      case 'filter':
        varMap.set(node.id, uniqueName('filtered'));
        break;
      case 'groupBy':
        varMap.set(node.id, uniqueName('grouped'));
        break;
      case 'sort':
        varMap.set(node.id, uniqueName('sorted'));
        break;
      case 'select':
        varMap.set(node.id, uniqueName('selected'));
        break;
      case 'transform':
        varMap.set(node.id, uniqueName('transformed'));
        break;
      case 'computedColumn':
        varMap.set(node.id, uniqueName('computed'));
        break;
      case 'reshape':
        varMap.set(node.id, uniqueName('reshaped'));
        break;
      case 'chart':
        varMap.set(node.id, 'chart');
        break;
      default:
        varMap.set(node.id, uniqueName('step'));
    }
  }

  return varMap;
}

export function exportAsJavaScript(nodes: Node[], edges: Edge[]): string {
  const sorted = topologicalSort(nodes, edges);
  const sections: string[] = [];
  const varNames = buildVariableNames(sorted);

  // Build a map from target node → source node (for finding upstream variable)
  const parentMap = new Map<string, string>();
  for (const edge of edges) {
    parentMap.set(edge.target, edge.source);
  }

  sections.push(`// Convoy Pipeline — exported D3.js script
// Generated on ${new Date().toISOString()}
// Drop this into an HTML file with <script src="https://d3js.org/d3.v7.min.js">
`);

  sections.push(`async function main() {`);

  for (const node of sorted) {
    const { code, nodeType, label } = getNodeCode(node);
    const varName = varNames.get(node.id) || 'step';
    const parentId = parentMap.get(node.id);
    const inputVar = parentId ? varNames.get(parentId) || 'data' : 'data';

    if (nodeType === 'dataSource') {
      const fileName = (node.data as Record<string, unknown>).fileName as string | undefined;
      if (fileName) {
        sections.push(`  // Load data
  const ${varName} = await d3.csv(${JSON.stringify(fileName)}, d3.autoType);
`);
      } else {
        sections.push(`  // TODO: Replace with your data source
  const ${varName} = await d3.csv("your-file.csv", d3.autoType);
`);
      }
    } else if (nodeType === 'chart') {
      // Chart node — inline the D3 chart code, referencing the upstream variable
      sections.push(`  // Chart: ${label}
  const chartData = ${inputVar};

  ${code.split('\n').join('\n  ').replace(/\bdata\b/g, 'chartData')}
`);
    } else if (nodeType === 'filter') {
      // Extract the clean D3 code from the generated code
      const data = node.data as Record<string, unknown>;
      const col = data.column as string;
      const op = data.operator as string;
      const val = data.value as string;

      if (col && op) {
        const numValue = Number(val);
        const isNumeric = val !== '' && !isNaN(numValue);

        let condition: string;
        switch (op) {
          case 'eq':
            condition = isNumeric ? `+d[${JSON.stringify(col)}] === ${numValue}` : `d[${JSON.stringify(col)}] === ${JSON.stringify(val)}`;
            break;
          case 'neq':
            condition = isNumeric ? `+d[${JSON.stringify(col)}] !== ${numValue}` : `d[${JSON.stringify(col)}] !== ${JSON.stringify(val)}`;
            break;
          case 'gt':
            condition = `+d[${JSON.stringify(col)}] > ${numValue}`;
            break;
          case 'lt':
            condition = `+d[${JSON.stringify(col)}] < ${numValue}`;
            break;
          case 'contains':
            condition = `String(d[${JSON.stringify(col)}] ?? "").toLowerCase().includes(${JSON.stringify(String(val).toLowerCase())})`;
            break;
          case 'startsWith':
            condition = `String(d[${JSON.stringify(col)}] ?? "").toLowerCase().startsWith(${JSON.stringify(String(val).toLowerCase())})`;
            break;
          default:
            condition = 'true';
        }
        sections.push(`  // ${label}
  const ${varName} = d3.filter(${inputVar}, d => ${condition});
`);
      } else {
        sections.push(`  // ${label} (not configured)
  const ${varName} = ${inputVar};
`);
      }
    } else if (nodeType === 'groupBy') {
      const data = node.data as Record<string, unknown>;
      const groupCol = data.groupByColumn as string;
      const aggCol = (data.aggregateColumn as string) || groupCol;
      const agg = data.aggregation as string;

      if (groupCol && agg) {
        const resultColName = agg === 'count' ? 'count' : `${agg}_${aggCol}`;
        let rollupFn: string;
        switch (agg) {
          case 'count': rollupFn = `v => v.length`; break;
          case 'sum': rollupFn = `v => d3.sum(v, d => +d[${JSON.stringify(aggCol)}])`; break;
          case 'avg': rollupFn = `v => d3.mean(v, d => +d[${JSON.stringify(aggCol)}])`; break;
          case 'min': rollupFn = `v => d3.min(v, d => +d[${JSON.stringify(aggCol)}])`; break;
          case 'max': rollupFn = `v => d3.max(v, d => +d[${JSON.stringify(aggCol)}])`; break;
          default: rollupFn = `v => v.length`;
        }

        sections.push(`  // ${label}
  const ${varName} = d3.flatRollup(${inputVar}, ${rollupFn}, d => d[${JSON.stringify(groupCol)}])
    .map(([key, val]) => ({ ${JSON.stringify(groupCol).slice(1, -1)}: key, ${JSON.stringify(resultColName).slice(1, -1)}: val }));
`);
      } else {
        sections.push(`  // ${label} (not configured)
  const ${varName} = ${inputVar};
`);
      }
    } else if (nodeType === 'sort') {
      const data = node.data as Record<string, unknown>;
      const col = data.column as string;
      const dir = data.direction as string;

      if (col) {
        const compareFn = dir === 'desc' ? 'd3.descending' : 'd3.ascending';
        sections.push(`  // ${label}
  const ${varName} = d3.sort(${inputVar}, (a, b) => ${compareFn}(a[${JSON.stringify(col)}], b[${JSON.stringify(col)}]));
`);
      } else {
        sections.push(`  // ${label} (not configured)
  const ${varName} = ${inputVar};
`);
      }
    } else if (nodeType === 'select') {
      const data = node.data as Record<string, unknown>;
      const cols = data.columns as string[] | undefined;

      if (cols && cols.length > 0) {
        const allSimple = cols.every((c) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(c));
        if (allSimple) {
          sections.push(`  // ${label}
  const ${varName} = ${inputVar}.map(({ ${cols.join(', ')} }) => ({ ${cols.join(', ')} }));
`);
        } else {
          const keys = cols.map((c) => JSON.stringify(c)).join(', ');
          sections.push(`  // ${label}
  const __keep = [${keys}];
  const ${varName} = ${inputVar}.map(d => Object.fromEntries(__keep.map(k => [k, d[k]])));
`);
        }
      } else {
        sections.push(`  // ${label} (not configured)
  const ${varName} = ${inputVar};
`);
      }
    } else if (nodeType === 'computedColumn') {
      const data = node.data as Record<string, unknown>;
      const newCol = data.newColumnName as string;
      const expression = data.expression as string;

      if (newCol && expression) {
        sections.push(`  // ${label}
  const ${varName} = ${inputVar}.map(d => ({ ...d, ${JSON.stringify(newCol).slice(1, -1)}: ${expression} }));
`);
      } else {
        sections.push(`  // ${label} (not configured)
  const ${varName} = ${inputVar};
`);
      }
    } else if (nodeType === 'reshape') {
      const data = node.data as Record<string, unknown>;
      const keyColumn = data.keyColumn as string;
      const valueColumn = data.valueColumn as string;
      const pivotColumns = data.pivotColumns as string[] | undefined;

      if (keyColumn && valueColumn && pivotColumns && pivotColumns.length > 0) {
        const pivotList = pivotColumns.map((c) => JSON.stringify(c)).join(', ');
        sections.push(`  // ${label}
  const __pivotCols = [${pivotList}];
  const __keepCols = Object.keys(${inputVar}[0] || {}).filter(k => !__pivotCols.includes(k));
  const ${varName} = ${inputVar}.flatMap(d => {
    const base = Object.fromEntries(__keepCols.map(k => [k, d[k]]));
    return __pivotCols.map(col => ({ ...base, ${JSON.stringify(keyColumn).slice(1, -1)}: col, ${JSON.stringify(valueColumn).slice(1, -1)}: d[col] }));
  });
`);
      } else {
        sections.push(`  // ${label} (not configured)
  const ${varName} = ${inputVar};
`);
      }
    } else {
      // Generic transform: inline the custom code as a function
      sections.push(`  // ${label}
  const ${varName} = (() => {
    const rows = ${inputVar};
    ${code.split('\n').join('\n    ')}
  })()?.rows ?? ${inputVar};
`);
    }
  }

  // Find the last non-chart variable for output
  const lastNonChart = [...sorted].reverse().find((n) => n.type !== 'chart');
  const outputVar = lastNonChart ? varNames.get(lastNonChart.id) || 'data' : 'data';

  sections.push(`  console.log(\`Pipeline complete: \${${outputVar}.length} rows\`);
  console.table(${outputVar}.slice(0, 5));
}`);

  sections.push(`\nmain();`);

  return sections.join('\n');
}

// ─── Python Export ──────────────────────────────────────────────────────────

export function exportAsPython(nodes: Node[], edges: Edge[]): string {
  const sorted = topologicalSort(nodes, edges);
  const sections: string[] = [];

  sections.push(`# Convoy Pipeline — Exported Python
# Generated on ${new Date().toISOString()}
# Run with: python pipeline.py

import pandas as pd
`);

  for (const node of sorted) {
    const data = node.data as Record<string, unknown>;
    const nodeType = node.type || 'unknown';
    const label = (data.label as string) || nodeType;

    // Build config
    const config = { ...data };
    delete config.state;
    delete config.label;
    delete config.isCodeMode;
    delete config.customCode;
    delete config.error;
    delete config.inputRowCount;
    delete config.outputRowCount;

    sections.push(`# ─── ${label} (${nodeType}) ${'─'.repeat(Math.max(0, 50 - label.length - nodeType.length))}`);

    if (nodeType === 'dataSource') {
      const fileName = config.fileName as string | undefined;
      if (fileName) {
        sections.push(`df = pd.read_csv(${JSON.stringify(fileName)})
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
`);
      } else {
        sections.push(`# TODO: Replace with your data loading code
df = pd.DataFrame()
`);
      }
    } else if (nodeType === 'chart') {
      sections.push(`import matplotlib.pyplot as plt

`);
      // Generate Python chart code
      const { chartType, xAxis, yAxis } = config;
      if (xAxis && yAxis) {
        switch (chartType) {
          case 'bar':
            sections.push(`plt.figure(figsize=(10, 6))
plt.bar(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          case 'line':
            sections.push(`plt.figure(figsize=(10, 6))
plt.plot(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          case 'scatter':
            sections.push(`plt.figure(figsize=(10, 6))
plt.scatter(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          case 'pie':
            sections.push(`plt.figure(figsize=(10, 6))
plt.pie(df["${yAxis}"], labels=df["${xAxis}"], autopct="%1.1f%%")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          default:
            sections.push(`plt.figure(figsize=(10, 6))
plt.bar(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
        }
      }
    } else if (nodeType === 'filter') {
      const { column, operator, value } = config;
      if (column && operator) {
        const opMap: Record<string, string> = { eq: '==', neq: '!=', gt: '>', lt: '<' };
        const numValue = Number(value);
        const isNumeric = value !== '' && !isNaN(numValue);
        const fmtVal = isNumeric ? String(numValue) : `"${value}"`;

        if (operator === 'contains') {
          sections.push(`df = df[df["${column}"].str.contains("${value}", case=False, na=False)]`);
        } else if (operator === 'startsWith') {
          sections.push(`df = df[df["${column}"].str.startswith("${value}", na=False)]`);
        } else {
          sections.push(`df = df[df["${column}"] ${opMap[operator as string] || '=='} ${fmtVal}]`);
        }
        sections.push(`print(f"After filter: {len(df)} rows")\n`);
      }
    } else if (nodeType === 'groupBy') {
      const { groupByColumn, aggregateColumn, aggregation } = config;
      if (groupByColumn && aggregation) {
        const pandasAgg = aggregation === 'avg' ? 'mean' : aggregation;
        const aggCol = aggregateColumn || groupByColumn;
        sections.push(`df = df.groupby("${groupByColumn}")["${aggCol}"].${pandasAgg}().reset_index()
print(f"After groupBy: {len(df)} groups")\n`);
      }
    } else if (nodeType === 'sort') {
      const { column, direction } = config;
      if (column) {
        const ascending = direction !== 'desc';
        sections.push(`df = df.sort_values("${column}", ascending=${ascending ? 'True' : 'False'})
print(f"Sorted by ${column}")\n`);
      }
    } else if (nodeType === 'select') {
      const cols = config.columns as string[] | undefined;
      if (cols && cols.length > 0) {
        sections.push(`df = df[${JSON.stringify(cols)}]
print(f"Selected ${cols.length} columns")\n`);
      }
    } else if (nodeType === 'transform') {
      sections.push(`# Custom transform — translate the JavaScript code below to pandas:
# ${(data.customCode as string || '// no custom code').split('\n').join('\n# ')}
# TODO: Implement this transform in Python
`);
    }
  }

  sections.push(`# ─── Output ─────────────────────────────────────────────────────────────────
print(f"\\nPipeline complete: {len(df)} rows, {len(df.columns)} columns")
print(df.head())
`);

  return sections.join('\n');
}

/**
 * Trigger a file download in the browser.
 */
function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the pipeline as a downloadable script.
 */
export function downloadPipelineScript(
  nodes: Node[],
  edges: Edge[],
  format: 'javascript' | 'python'
) {
  const timestamp = Date.now();
  if (format === 'javascript') {
    const script = exportAsJavaScript(nodes, edges);
    downloadFile(script, `convoy-pipeline-${timestamp}.js`);
  } else {
    const script = exportAsPython(nodes, edges);
    downloadFile(script, `convoy-pipeline-${timestamp}.py`);
  }
}
