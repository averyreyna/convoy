import type { Node, Edge } from '@xyflow/react';
import { generateNodeCode } from './codeGenerators';

/**
 * Walk the node graph in topological order (DataSource → ... → Chart)
 * and return the ordered list of nodes.
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
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
 * Export the pipeline as a downloadable Python script.
 */
export function downloadPipelineScript(nodes: Node[], edges: Edge[]) {
  const timestamp = Date.now();
  const script = exportAsPython(nodes, edges);
  downloadFile(script, `convoy-pipeline-${timestamp}.py`);
}

/** Jupyter notebook cell (code). */
interface NotebookCodeCell {
  cell_type: 'code';
  source: string[];
  execution_count: null;
  outputs: unknown[];
  metadata: Record<string, unknown>;
}

/**
 * Build Jupyter notebook (.ipynb) JSON from the pipeline.
 */
export function exportAsNotebookJson(nodes: Node[], edges: Edge[]): string {
  const sorted = topologicalSort(nodes, edges);
  const cells: NotebookCodeCell[] = [];

  cells.push({
    cell_type: 'code',
    source: ['import pandas as pd\n'],
    execution_count: null,
    outputs: [],
    metadata: {},
  });

  for (const node of sorted) {
    const { code, label } = getNodeCode(node);
    const lines = code.split('\n').map((line) => line + '\n');
    if (lines.length > 0 && lines[lines.length - 1] === '\n') {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
    }
    cells.push({
      cell_type: 'code',
      source: lines,
      execution_count: null,
      outputs: [],
      metadata: { convoy_cell_label: label },
    });
  }

  const notebook = {
    nbformat: 4,
    nbformat_minor: 4,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: { name: 'python', version: '3' },
    },
    cells,
  };
  return JSON.stringify(notebook, null, 1);
}

/**
 * Download the pipeline as a Jupyter notebook (.ipynb).
 */
export function downloadNotebook(nodes: Node[], edges: Edge[]) {
  const timestamp = Date.now();
  const json = exportAsNotebookJson(nodes, edges);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `convoy-pipeline-${timestamp}.ipynb`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy pipeline as Jupyter-style cells (each block separated by "# %%") for pasting into VS Code / Jupyter.
 */
export function copyAsJupyterCells(nodes: Node[], edges: Edge[]): string {
  const sorted = topologicalSort(nodes, edges);
  const parts: string[] = ['# %%\nimport pandas as pd\n'];
  for (const node of sorted) {
    const { code, label } = getNodeCode(node);
    parts.push(`# %% ${label}\n${code}\n`);
  }
  return parts.join('\n');
}
