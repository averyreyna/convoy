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
});
