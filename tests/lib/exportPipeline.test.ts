import { describe, it, expect } from 'vitest';
import {
  topologicalSort,
  pipelineNodesOnly,
  topologicalSortPipeline,
  exportAsPython,
  exportAsNotebookJson,
  buildScriptFromCellCodes,
  buildScriptForBrowserRun,
  copyAsJupyterCells,
  type CellCode,
} from '@/lib/exportPipeline';
import type { Node, Edge } from '@xyflow/react';

function node(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return {
    id,
    type,
    data: { label: type, ...data },
    position: { x: 0, y: 0 },
  } as Node;
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

describe('topologicalSort', () => {
  it('returns empty array for empty nodes and edges', () => {
    expect(topologicalSort([], [])).toEqual([]);
  });

  it('returns single node when only one node', () => {
    const nodes = [node('a', 'dataSource')];
    expect(topologicalSort(nodes, [])).toEqual(nodes);
  });

  it('returns linear chain A → B → C in order', () => {
    const a = node('a', 'dataSource');
    const b = node('b', 'filter');
    const c = node('c', 'sort');
    const nodes = [c, a, b];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    const sorted = topologicalSort(nodes, edges);
    expect(sorted.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns diamond A → B, A → C, B → D, C → D with A first and D last', () => {
    const a = node('a', 'dataSource');
    const b = node('b', 'filter');
    const c = node('c', 'filter');
    const d = node('d', 'sort');
    const nodes = [a, b, c, d];
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'a', 'c'),
      edge('e3', 'b', 'd'),
      edge('e4', 'c', 'd'),
    ];
    const sorted = topologicalSort(nodes, edges);
    expect(sorted[0].id).toBe('a');
    expect(sorted[3].id).toBe('d');
    expect(sorted.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('pipelineNodesOnly', () => {
  it('excludes aiQuery and aiAdvisor nodes and edges referencing them', () => {
    const dataNode = node('d1', 'dataSource');
    const filterNode = node('f1', 'filter');
    const aiNode = node('ai1', 'aiQuery');
    const nodes = [dataNode, filterNode, aiNode];
    const edges = [
      edge('e1', 'd1', 'f1'),
      edge('e2', 'd1', 'ai1'),
      edge('e3', 'ai1', 'f1'),
    ];
    const { nodes: outNodes, edges: outEdges } = pipelineNodesOnly(nodes, edges);
    expect(outNodes.map((n) => n.id)).toEqual(['d1', 'f1']);
    expect(outEdges.map((e) => e.id)).toEqual(['e1']);
  });

  it('keeps only data nodes and edges between them', () => {
    const a = node('a', 'filter');
    const b = node('b', 'sort');
    const ai = node('ai', 'aiAdvisor');
    const nodes = [a, b, ai];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'ai'), edge('e3', 'ai', 'b')];
    const { nodes: outNodes, edges: outEdges } = pipelineNodesOnly(nodes, edges);
    expect(outNodes).toHaveLength(2);
    expect(outEdges).toHaveLength(1);
    expect(outEdges[0].source).toBe('a');
    expect(outEdges[0].target).toBe('b');
  });
});

describe('topologicalSortPipeline', () => {
  it('applies pipelineNodesOnly then topologicalSort', () => {
    const dataNode = node('d', 'dataSource');
    const filterNode = node('f', 'filter', { column: 'x', operator: 'eq', value: '1' });
    const aiNode = node('ai', 'aiQuery');
    const nodes = [filterNode, dataNode, aiNode];
    const edges = [edge('e1', 'd', 'f'), edge('e2', 'd', 'ai')];
    const sorted = topologicalSortPipeline(nodes, edges);
    expect(sorted.map((n) => n.id)).toEqual(['d', 'f']);
  });
});

describe('exportAsPython', () => {
  it('contains import pandas and node comments and expected snippets for dataSource + filter', () => {
    const nodes = [
      node('d', 'dataSource', { fileName: 'data.csv' }),
      node('f', 'filter', { column: 'x', operator: 'eq', value: '1' }),
    ];
    const edges = [edge('e1', 'd', 'f')];
    const out = exportAsPython(nodes, edges);
    expect(out).toContain('import pandas as pd');
    expect(out).toContain('Convoy Pipeline');
    expect(out).toContain('pd.read_csv("data.csv")');
    expect(out).toContain('df["x"]');
    expect(out).toContain('==');
    expect(out).toContain('Pipeline complete');
  });
});

describe('exportAsNotebookJson', () => {
  it('returns valid JSON with nbformat and cells array reflecting node order', () => {
    const nodes = [
      node('d', 'dataSource', { fileName: 'out.csv' }),
      node('s', 'sort', { column: 'a' }),
    ];
    const edges = [edge('e1', 'd', 's')];
    const json = exportAsNotebookJson(nodes, edges);
    const nb = JSON.parse(json);
    expect(nb.nbformat).toBe(4);
    expect(Array.isArray(nb.cells)).toBe(true);
    expect(nb.cells.length).toBeGreaterThanOrEqual(2);
    expect(nb.cells[0].source.join('')).toContain('import pandas as pd');
    const cellSources = nb.cells.map((c: { source: string[] }) => c.source.join(''));
    expect(cellSources.some((s: string) => s.includes('read_csv'))).toBe(true);
    expect(cellSources.some((s: string) => s.includes('sort_values'))).toBe(true);
  });
});

describe('buildScriptFromCellCodes', () => {
  it('returns empty string for empty array', () => {
    expect(buildScriptFromCellCodes([])).toBe('');
  });

  it('returns preamble and all cells when no upToIndex', () => {
    const cells: CellCode[] = [
      { code: 'df = df[["a"]]', nodeType: 'select' },
      { code: 'df = df.sort_values("a")', nodeType: 'sort' },
    ];
    const out = buildScriptFromCellCodes(cells);
    expect(out).toContain('import pandas as pd');
    expect(out).toContain('df = df[["a"]]');
    expect(out).toContain('df = df.sort_values("a")');
  });

  it('includes only cells up to upToIndex (inclusive)', () => {
    const cells: CellCode[] = [
      { code: 'c1', nodeType: 'filter' },
      { code: 'c2', nodeType: 'sort' },
      { code: 'c3', nodeType: 'chart' },
    ];
    const out = buildScriptFromCellCodes(cells, 1);
    expect(out).toContain('c1');
    expect(out).toContain('c2');
    expect(out).not.toContain('c3');
  });
});

describe('buildScriptForBrowserRun', () => {
  it('replaces dataSource cell with pd.DataFrame() when no columnNames', () => {
    const cells: CellCode[] = [
      { code: 'df = pd.read_csv("x.csv")', nodeType: 'dataSource' },
      { code: 'df = df.head()', nodeType: 'transform' },
    ];
    const out = buildScriptForBrowserRun(cells);
    expect(out).toContain('Data source (file load skipped in browser)');
    expect(out).toContain('pd.DataFrame()');
    expect(out).not.toContain('read_csv');
    expect(out).toContain('df = df.head()');
  });

  it('replaces dataSource cell with pd.DataFrame(columns=[...]) when columnNames provided', () => {
    const cells: CellCode[] = [
      { code: 'df = pd.read_csv("x.csv")', nodeType: 'dataSource' },
    ];
    const out = buildScriptForBrowserRun(cells, undefined, ['a', 'b']);
    expect(out).toContain('pd.DataFrame(columns=["a", "b"])');
  });

  it('leaves non-dataSource cells unchanged', () => {
    const cells: CellCode[] = [
      { code: 'df = df[df["x"] > 0]', nodeType: 'filter' },
    ];
    const out = buildScriptForBrowserRun(cells);
    expect(out).toContain('df = df[df["x"] > 0]');
  });
});

describe('copyAsJupyterCells', () => {
  it('output contains # %%, import pandas, and cell blocks', () => {
    const nodes = [
      node('d', 'dataSource', { fileName: 'x.csv' }),
      node('f', 'filter', { column: 'a', operator: 'eq', value: '1' }),
    ];
    const edges = [edge('e1', 'd', 'f')];
    const out = copyAsJupyterCells(nodes, edges);
    expect(out).toContain('# %%');
    expect(out).toContain('import pandas as pd');
    expect(out).toContain('read_csv');
    expect(out).toContain('df["a"]');
  });
});
