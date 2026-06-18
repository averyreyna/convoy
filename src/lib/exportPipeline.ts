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

const META_NODE_TYPES = ['aiQuery', 'aiAdvisor', 'aiSummarizeData', 'aiDiagnose', 'canvasNote'] as const;

/**
 * Exclude AI/meta nodes (e.g. aiQuery, aiAdvisor) and their edges from the pipeline.
 * Used for export and Run all so only data-processing nodes are included.
 */
export function pipelineNodesOnly(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const nodesFiltered = nodes.filter(
    (n) => !META_NODE_TYPES.includes(n.type as (typeof META_NODE_TYPES)[number])
  );
  const idSet = new Set(nodesFiltered.map((n) => n.id));
  const edgesFiltered = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
  return { nodes: nodesFiltered, edges: edgesFiltered };
}

/**
 * Topological order of pipeline nodes only (excludes aiQuery, aiAdvisor).
 */
export function topologicalSortPipeline(nodes: Node[], edges: Edge[]): Node[] {
  const { nodes: pNodes, edges: pEdges } = pipelineNodesOnly(nodes, edges);
  return topologicalSort(pNodes, pEdges);
}

/**
 * The lineage feeding a node: the chain of pipeline nodes from the root source
 * down to (and including) `targetNodeId`, in execution order.
 *
 * Every node has at most one input (the graph only fans out, never in), so a
 * slice is always a single linear chain — which makes it a correct, runnable
 * sub-pipeline on its own. Returns [] if the target isn't a pipeline node.
 */
export function backwardSlice(targetNodeId: string, nodes: Node[], edges: Edge[]): Node[] {
  const { nodes: pNodes, edges: pEdges } = pipelineNodesOnly(nodes, edges);
  const nodeMap = new Map(pNodes.map((n) => [n.id, n]));
  if (!nodeMap.has(targetNodeId)) return [];

  // target → source lookup (≤1 parent per node given fan-out-only graphs).
  const parentOf = new Map<string, string>();
  for (const e of pEdges) parentOf.set(e.target, e.source);

  const chain: Node[] = [];
  const seen = new Set<string>();
  let current: string | undefined = targetNodeId;
  while (current && nodeMap.has(current) && !seen.has(current)) {
    seen.add(current);
    chain.unshift(nodeMap.get(current)!);
    current = parentOf.get(current);
  }
  return chain;
}

/**
 * Terminal pipeline nodes (no outgoing edge to another pipeline node). Each leaf
 * is the end of one lineage; "Run all" runs every leaf's slice.
 */
export function leafPipelineNodes(nodes: Node[], edges: Edge[]): Node[] {
  const { nodes: pNodes, edges: pEdges } = pipelineNodesOnly(nodes, edges);
  const hasOutgoing = new Set(pEdges.map((e) => e.source));
  return pNodes.filter((n) => !hasOutgoing.has(n.id));
}

/**
 * True when a pipeline node fans out to 2+ children. A single mutated `df` can't
 * faithfully represent that, so exports of a branching pipeline thread results
 * through named per-node variables instead.
 */
export function pipelineHasBranch(nodes: Node[], edges: Edge[]): boolean {
  const { edges: pEdges } = pipelineNodesOnly(nodes, edges);
  const outCount = new Map<string, number>();
  for (const e of pEdges) {
    outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1);
  }
  for (const count of outCount.values()) {
    if (count >= 2) return true;
  }
  return false;
}

/** A node's generated code, threaded through a named variable for branching export. */
export interface ThreadedBlock {
  nodeId: string;
  label: string;
  nodeType: string;
  /** Rebind from parent var + the node's verbatim single-`df` code + capture into this node's var. */
  code: string;
  /** The variable this node's output is captured into (e.g. df_filter). */
  varName: string;
}

/** Turn a label into a unique, valid python identifier like `df_select_columns`. */
function pythonVarName(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `df_${slug || 'step'}`;
}

/**
 * Per-node code for a branching pipeline, threaded through named variables so
 * each node reads its real parent's output rather than a single shared `df`.
 *
 * Each block rebinds `df` from the parent's captured variable, runs the node's
 * existing (single-`df`) snippet verbatim, then captures the result into a named
 * variable. Wrapping rather than rewriting keeps user-authored `df` references
 * (computedColumn expressions, transform / aiCleanData code) correct without
 * fragile string substitution; the `.copy()` on rebind keeps in-place mutations
 * (e.g. computedColumn) from corrupting a shared upstream frame.
 */
export function buildThreadedBlocks(nodes: Node[], edges: Edge[]): ThreadedBlock[] {
  const { nodes: pNodes, edges: pEdges } = pipelineNodesOnly(nodes, edges);
  const ordered = topologicalSort(pNodes, pEdges);

  const parentOf = new Map<string, string>();
  for (const e of pEdges) parentOf.set(e.target, e.source);

  const varOf = new Map<string, string>();
  const used = new Set<string>();
  for (const node of ordered) {
    const base = pythonVarName(getNodeCode(node).label);
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base}_${n++}`;
    used.add(name);
    varOf.set(node.id, name);
  }

  return ordered.map((node) => {
    const { code, label, nodeType } = getNodeCode(node);
    const outVar = varOf.get(node.id)!;
    const parentId = parentOf.get(node.id);
    const inVar = parentId ? varOf.get(parentId) : undefined;

    const lines: string[] = [];
    if (inVar) lines.push(`df = ${inVar}.copy()`);
    lines.push(code.trim());
    lines.push(`${outVar} = df`);
    return { nodeId: node.id, label, nodeType, code: lines.join('\n'), varName: outVar };
  });
}

/**
 * Full Python export for a branching pipeline, using named per-node variables.
 * Linear pipelines use the cleaner single-`df` `exportAsPython` instead.
 */
export function exportAsThreadedPython(nodes: Node[], edges: Edge[]): string {
  const blocks = buildThreadedBlocks(nodes, edges);
  const parts: string[] = [
    `# Convoy Pipeline — Exported Python (branching)
# Generated on ${new Date().toISOString()}
# Each step reads its upstream variable so branches stay independent.

import pandas as pd
`,
  ];
  for (const b of blocks) {
    const rule = '─'.repeat(Math.max(0, 50 - b.label.length - b.nodeType.length));
    parts.push(`# ─── ${b.label} (${b.nodeType}) ${rule}\n${b.code}\n`);
  }
  return parts.join('\n');
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

  if (
    nodeType === 'aiCleanData' &&
    data.generatedCode &&
    typeof data.generatedCode === 'string' &&
    data.generatedCode.trim() !== ''
  ) {
    return { code: data.generatedCode.trim(), nodeType, label };
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

export type ExportAsPythonOnSection = (nodeId: string | null, section: string) => void;

export function exportAsPython(
  nodes: Node[],
  edges: Edge[],
  onSection?: ExportAsPythonOnSection
): string {
  const sorted = topologicalSortPipeline(nodes, edges);
  const sections: string[] = [];

  function pushSection(nodeId: string | null, section: string) {
    sections.push(section);
    onSection?.(nodeId, section);
  }

  pushSection(null, `# Convoy Pipeline — Exported Python
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

    pushSection(node.id, `# ─── ${label} (${nodeType}) ${'─'.repeat(Math.max(0, 50 - label.length - nodeType.length))}`);

    if (nodeType === 'dataSource') {
      const fileName = config.fileName as string | undefined;
      if (fileName) {
        pushSection(node.id, `df = pd.read_csv(${JSON.stringify(fileName)})
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
`);
      } else {
        pushSection(node.id, `# TODO: Replace with your data loading code
df = pd.DataFrame()
`);
      }
    } else if (nodeType === 'chart') {
      pushSection(node.id, `import matplotlib.pyplot as plt

`);
      // Generate Python chart code
      const { chartType, xAxis, yAxis } = config;
      if (xAxis && yAxis) {
        switch (chartType) {
          case 'bar':
            pushSection(node.id, `plt.figure(figsize=(10, 6))
plt.bar(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          case 'line':
            pushSection(node.id, `plt.figure(figsize=(10, 6))
plt.plot(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          case 'scatter':
            pushSection(node.id, `plt.figure(figsize=(10, 6))
plt.scatter(df["${xAxis}"], df["${yAxis}"])
plt.xlabel("${xAxis}")
plt.ylabel("${yAxis}")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          case 'pie':
            pushSection(node.id, `plt.figure(figsize=(10, 6))
plt.pie(df["${yAxis}"], labels=df["${xAxis}"], autopct="%1.1f%%")
plt.title("${yAxis} by ${xAxis}")
plt.tight_layout()
plt.show()
`);
            break;
          default:
            pushSection(node.id, `plt.figure(figsize=(10, 6))
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
          pushSection(node.id, `df = df[df["${column}"].str.contains("${value}", case=False, na=False)]`);
        } else if (operator === 'startsWith') {
          pushSection(node.id, `df = df[df["${column}"].str.startswith("${value}", na=False)]`);
        } else {
          pushSection(node.id, `df = df[df["${column}"] ${opMap[operator as string] || '=='} ${fmtVal}]`);
        }
        pushSection(node.id, `print(f"After filter: {len(df)} rows")\n`);
      }
    } else if (nodeType === 'groupBy') {
      const { groupByColumn, aggregateColumn, aggregation } = config;
      if (groupByColumn && aggregation) {
        const pandasAgg = aggregation === 'avg' ? 'mean' : aggregation;
        const aggCol = aggregateColumn || groupByColumn;
        pushSection(node.id, `df = df.groupby("${groupByColumn}")["${aggCol}"].${pandasAgg}().reset_index()
print(f"After groupBy: {len(df)} groups")\n`);
      }
    } else if (nodeType === 'sort') {
      const { column, direction } = config;
      if (column) {
        const ascending = direction !== 'desc';
        pushSection(node.id, `df = df.sort_values("${column}", ascending=${ascending ? 'True' : 'False'})
print(f"Sorted by ${column}")\n`);
      }
    } else if (nodeType === 'select') {
      const cols = config.columns as string[] | undefined;
      if (cols && cols.length > 0) {
        pushSection(node.id, `df = df[${JSON.stringify(cols)}]
print(f"Selected ${cols.length} columns")\n`);
      }
    } else if (nodeType === 'transform') {
      pushSection(node.id, `# Custom transform — translate the custom code below to pandas:
# ${(data.customCode as string || '// no custom code').split('\n').join('\n# ')}
# TODO: Implement this transform in Python
`);
    } else if (nodeType === 'aiCleanData') {
      const generatedCode = data.generatedCode as string | undefined;
      if (generatedCode && typeof generatedCode === 'string' && generatedCode.trim() !== '') {
        pushSection(node.id, generatedCode.trim() + '\n');
      } else {
        pushSection(node.id, `# AI Clean Data — run in app to generate code\n`);
      }
    }
  }

  pushSection(null, `# ─── Output ─────────────────────────────────────────────────────────────────
print(f"\\nPipeline complete: {len(df)} rows, {len(df.columns)} columns")
print(df.head())
`);

  return sections.join('\n');
}

/**
 * Export pipeline as Python and get a mapping from 1-based line number to node ID.
 * Used by diff UIs to make lines clickable (focus that node/cell).
 */
export function exportAsPythonWithLineMap(
  nodes: Node[],
  edges: Edge[]
): { script: string; getNodeIdForLine: (lineNum: number) => string | null } {
  const lineToNodeId: (string | null)[] = [];
  const script = exportAsPython(nodes, edges, (nodeId, section) => {
    const lineCount = section.split('\n').length;
    for (let i = 0; i < lineCount; i++) lineToNodeId.push(nodeId);
  });
  return {
    script,
    getNodeIdForLine: (lineNum: number) => lineToNodeId[lineNum - 1] ?? null,
  };
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
  const script = pipelineHasBranch(nodes, edges)
    ? exportAsThreadedPython(nodes, edges)
    : exportAsPython(nodes, edges);
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
  const cells: NotebookCodeCell[] = [];

  cells.push({
    cell_type: 'code',
    source: ['import pandas as pd\n'],
    execution_count: null,
    outputs: [],
    metadata: {},
  });

  // Branching pipelines thread named variables so each branch stays independent;
  // linear pipelines keep the cleaner single-`df` per-cell code.
  const codeByCell = pipelineHasBranch(nodes, edges)
    ? buildThreadedBlocks(nodes, edges).map((b) => ({ code: b.code, label: b.label }))
    : topologicalSortPipeline(nodes, edges).map((node) => {
        const { code, label } = getNodeCode(node);
        return { code, label };
      });

  for (const { code, label } of codeByCell) {
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
  const parts: string[] = ['# %%\nimport pandas as pd\n'];
  const codeByCell = pipelineHasBranch(nodes, edges)
    ? buildThreadedBlocks(nodes, edges).map((b) => ({ code: b.code, label: b.label }))
    : topologicalSortPipeline(nodes, edges).map((node) => {
        const { code, label } = getNodeCode(node);
        return { code, label };
      });
  for (const { code, label } of codeByCell) {
    parts.push(`# %% ${label}\n${code}\n`);
  }
  return parts.join('\n');
}

/** Cell code + node type for building a runnable script. */
export interface CellCode {
  code: string;
  nodeType: string;
}

/**
 * Build a runnable Python script from an ordered list of cell codes.
 * Prepends import pandas; optionally limits to cells 0..upToIndex (inclusive) for "Run cell".
 */
export function buildScriptFromCellCodes(
  cells: CellCode[],
  upToIndex?: number
): string {
  if (cells.length === 0) return '';
  const end = upToIndex !== undefined ? Math.min(upToIndex + 1, cells.length) : cells.length;
  const slice = cells.slice(0, end);
  const body = slice.map((c) => c.code.trim()).join('\n\n');
  const preamble = 'import pandas as pd\n\n';
  return preamble + body;
}

/**
 * Build a script safe to run in the browser (Pyodide). Data source cells are not executed
 * (no pd.read_csv etc.) and are replaced with a placeholder so downstream cells receive
 * an empty DataFrame with the same columns when columnNames is provided (avoids KeyError
 * in sort_values, groupby, etc.). Use this for "Run all" / "Run cell"; use the full script for export and import.
 */
export function buildScriptForBrowserRun(
  cells: CellCode[],
  upToIndex?: number,
  columnNames?: string[]
): string {
  if (cells.length === 0) return '';
  const end = upToIndex !== undefined ? Math.min(upToIndex + 1, cells.length) : cells.length;
  const slice = cells.slice(0, end);
  const body = slice
    .map((c) => {
      if (c.nodeType === 'dataSource') {
        if (columnNames?.length) {
          const cols = columnNames.map((n) => JSON.stringify(n)).join(', ');
          return `# Data source (file load skipped in browser)\ndf = pd.DataFrame(columns=[${cols}])`;
        }
        return '# Data source (file load skipped in browser)\ndf = pd.DataFrame()';
      }
      return c.code.trim();
    })
    .join('\n\n');
  const preamble = 'import pandas as pd\n\n';
  return preamble + body;
}

function isHoleCellCode(code: string): boolean {
  const trimmed = code.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

/**
 * Build a script for live eval with hole cells skipped (comment placeholders).
 * Data source cells use the empty-frame trick when columnNames are provided.
 */
export function buildScriptForLiveEval(
  cells: CellCode[],
  upToIndex?: number,
  columnNames?: string[]
): string {
  if (cells.length === 0) return '';
  const end = upToIndex !== undefined ? Math.min(upToIndex + 1, cells.length) : cells.length;
  const slice = cells.slice(0, end);
  const body = slice
    .map((c) => {
      if (c.nodeType === 'dataSource') {
        if (columnNames?.length) {
          const cols = columnNames.map((n) => JSON.stringify(n)).join(', ');
          return `# Data source (file load skipped in browser)\ndf = pd.DataFrame(columns=[${cols}])`;
        }
        return '# Data source (file load skipped in browser)\ndf = pd.DataFrame()';
      }
      if (isHoleCellCode(c.code)) {
        return '# hole — skipped';
      }
      return c.code.trim();
    })
    .join('\n\n');
  const preamble = 'import pandas as pd\n\n';
  return preamble + body;
}
