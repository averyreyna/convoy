import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/stores/canvasStore';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type: string): Node {
  return {
    id,
    type,
    data: { label: type },
    position: { x: 0, y: 0 },
  } as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

describe('canvasStore', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [], edges: [] });
  });

  describe('addNode', () => {
    it('appends node to nodes', () => {
      const n = makeNode('n1', 'dataSource');
      useCanvasStore.getState().addNode(n);
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
      expect(useCanvasStore.getState().nodes[0].id).toBe('n1');
    });

    it('adds multiple nodes in order', () => {
      useCanvasStore.getState().addNode(makeNode('a', 'filter'));
      useCanvasStore.getState().addNode(makeNode('b', 'sort'));
      expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    });
  });

  describe('addEdgeToStore', () => {
    it('appends edge to edges', () => {
      useCanvasStore.getState().addEdgeToStore(makeEdge('e1', 'a', 'b'));
      expect(useCanvasStore.getState().edges).toHaveLength(1);
      expect(useCanvasStore.getState().edges[0].source).toBe('a');
      expect(useCanvasStore.getState().edges[0].target).toBe('b');
    });
  });

  describe('setSelectedNodeIds', () => {
    it('sets selected on nodes whose id is in the list', () => {
      useCanvasStore.getState().addNode(makeNode('n1', 'filter'));
      useCanvasStore.getState().addNode(makeNode('n2', 'sort'));
      useCanvasStore.getState().setSelectedNodeIds(['n2']);
      const nodes = useCanvasStore.getState().nodes;
      expect(nodes.find((n) => n.id === 'n1')?.selected).toBe(false);
      expect(nodes.find((n) => n.id === 'n2')?.selected).toBe(true);
    });
  });

  describe('baseline', () => {
    it('setBaselineFromPin sets baselineCode and baselineLanguage', () => {
      useCanvasStore.getState().setBaselineFromPin('print(1)', 'python');
      expect(useCanvasStore.getState().baselineCode).toBe('print(1)');
      expect(useCanvasStore.getState().baselineLanguage).toBe('python');
    });

    it('clearBaseline clears baselineCode and baselineLanguage', () => {
      useCanvasStore.getState().setBaselineFromPin('code', 'python');
      useCanvasStore.getState().clearBaseline();
      expect(useCanvasStore.getState().baselineCode).toBeNull();
      expect(useCanvasStore.getState().baselineLanguage).toBeNull();
    });
  });

  describe('removeNode', () => {
    it('removes node by id and edges incident to it', () => {
      useCanvasStore.getState().addNode(makeNode('a', 'dataSource'));
      useCanvasStore.getState().addNode(makeNode('b', 'filter'));
      useCanvasStore.getState().addEdgeToStore(makeEdge('e1', 'a', 'b'));
      useCanvasStore.getState().removeNode('a');
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
      expect(useCanvasStore.getState().nodes[0].id).toBe('b');
      expect(useCanvasStore.getState().edges).toHaveLength(0);
    });
  });

  describe('addCellAsNode', () => {
    function seedDataSource() {
      useCanvasStore.setState({
        nodes: [
          {
            id: 'src',
            type: 'dataSource',
            data: { label: 'Data', state: 'confirmed' },
            position: { x: 0, y: 0 },
          } as Node,
        ],
        edges: [],
      });
    }

    it('classifies a structured cell into a typed node and chains off the leaf', () => {
      seedDataSource();
      const id = useCanvasStore
        .getState()
        .addCellAsNode('df = df[df["age"] > 30]');
      expect(id).not.toBeNull();
      const { nodes, edges } = useCanvasStore.getState();
      const created = nodes.find((n) => n.id === id);
      expect(created?.type).toBe('filter');
      // Config is stored (canonicalize on commit); no opaque customCode.
      expect(created?.data.column).toBe('age');
      expect(created?.data.customCode).toBeUndefined();
      // Edge wired from the existing leaf (the data source) to the new node.
      expect(edges.some((e) => e.source === 'src' && e.target === id)).toBe(true);
    });

    it('derives the node label from a leading comment', () => {
      seedDataSource();
      const id = useCanvasStore
        .getState()
        .addCellAsNode('# Adults only\ndf = df[df["age"] > 30]');
      const created = useCanvasStore.getState().nodes.find((n) => n.id === id);
      expect(created?.data.label).toBe('Adults only');
    });

    it('falls back to a transform carrying verbatim code for opaque cells', () => {
      seedDataSource();
      const id = useCanvasStore
        .getState()
        .addCellAsNode('df = df.assign(x=df["a"].rolling(3).mean())');
      const created = useCanvasStore.getState().nodes.find((n) => n.id === id);
      expect(created?.type).toBe('transform');
      expect(created?.data.customCode).toBe('df = df.assign(x=df["a"].rolling(3).mean())');
    });

    it('inserts mid-chain by rewiring the anchor’s downstream edges', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'src', type: 'dataSource', data: {}, position: { x: 0, y: 0 } } as Node,
          { id: 'leaf', type: 'sort', data: {}, position: { x: 320, y: 0 } } as Node,
        ],
        edges: [{ id: 'e1', source: 'src', target: 'leaf' } as Edge],
      });
      const id = useCanvasStore
        .getState()
        .addCellAsNode('df = df[df["age"] > 30]', { insertAfterNodeId: 'src' });
      const { edges } = useCanvasStore.getState();
      expect(edges.some((e) => e.source === 'src' && e.target === id)).toBe(true);
      expect(edges.some((e) => e.source === id && e.target === 'leaf')).toBe(true);
      expect(edges.some((e) => e.source === 'src' && e.target === 'leaf')).toBe(false);
    });

    it('returns null for an empty / comment-only hole', () => {
      seedDataSource();
      expect(useCanvasStore.getState().addCellAsNode('# just a note')).toBeNull();
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
    });
  });

  describe('staleNodeIds', () => {
    beforeEach(() => {
      useCanvasStore.setState({ staleNodeIds: {} });
      useCanvasStore.getState().addNode(makeNode('a', 'filter'));
      useCanvasStore.getState().addNode(makeNode('b', 'groupBy'));
      useCanvasStore.getState().addEdgeToStore(makeEdge('e1', 'a', 'b'));
    });

    it('markChildrenStale marks direct downstream nodes', () => {
      useCanvasStore.getState().markChildrenStale('a');
      expect(useCanvasStore.getState().staleNodeIds).toEqual({ b: true });
    });

    it('clearNodeStale removes a node stale mark', () => {
      useCanvasStore.getState().markChildrenStale('a');
      useCanvasStore.getState().clearNodeStale('b');
      expect(useCanvasStore.getState().staleNodeIds).toEqual({});
    });

    it('clearChildrenStale removes stale marks from direct children', () => {
      useCanvasStore.getState().markChildrenStale('a');
      useCanvasStore.getState().clearChildrenStale('a');
      expect(useCanvasStore.getState().staleNodeIds).toEqual({});
    });

    it('clearAllStale clears every stale mark', () => {
      useCanvasStore.getState().markChildrenStale('a');
      useCanvasStore.getState().clearAllStale();
      expect(useCanvasStore.getState().staleNodeIds).toEqual({});
    });
  });
});
