import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { ProposedPipeline } from '@/types';

interface CanvasStore {
  nodes: Node[];
  edges: Edge[];

  // Node operations
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Record<string, unknown>>) => void;
  removeNode: (id: string) => void;
  confirmNode: (id: string) => void;

  // Edge operations
  addEdgeToStore: (edge: Edge) => void;
  removeEdge: (id: string) => void;

  // Pipeline operations
  addProposedPipeline: (pipeline: ProposedPipeline) => void;
  confirmAllProposed: () => void;
  clearProposed: () => void;

  // React Flow callbacks
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
    })),

  confirmNode: (id) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, state: 'confirmed' } }
          : node
      ),
      // Also make edges connected to this node solid
      edges: state.edges.map((edge) =>
        edge.source === id || edge.target === id
          ? { ...edge, animated: true, style: {} }
          : edge
      ),
    })),

  addEdgeToStore: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    })),

  addProposedPipeline: (pipeline) => {
    const { nodes: existingNodes, edges: existingEdges } = get();

    // Find DataSource node to connect to
    const dataSourceNode = existingNodes.find((n) => n.type === 'dataSource');
    if (!dataSourceNode) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let previousNodeId = dataSourceNode.id;
    let xOffset = dataSourceNode.position.x + 320;

    pipeline.nodes.forEach((nodeConfig, index) => {
      const nodeId = `proposed-${Date.now()}-${index}`;

      newNodes.push({
        id: nodeId,
        type: nodeConfig.type,
        position: { x: xOffset, y: dataSourceNode.position.y },
        data: {
          state: 'proposed' as const,
          label: nodeConfig.type.charAt(0).toUpperCase() + nodeConfig.type.slice(1),
          ...nodeConfig.config,
        },
      });

      newEdges.push({
        id: `edge-${previousNodeId}-${nodeId}`,
        source: previousNodeId,
        target: nodeId,
        type: 'dataFlow',
        animated: true,
        style: { opacity: 0.5 },
      });

      previousNodeId = nodeId;
      xOffset += 320;
    });

    set({
      nodes: [...existingNodes, ...newNodes],
      edges: [...existingEdges, ...newEdges],
    });
  },

  confirmAllProposed: () =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.data.state === 'proposed'
          ? { ...node, data: { ...node.data, state: 'confirmed' } }
          : node
      ),
      edges: state.edges.map((edge) => ({
        ...edge,
        style: {},
        animated: true,
      })),
    })),

  clearProposed: () =>
    set((state) => {
      const proposedIds = new Set(
        state.nodes
          .filter((n) => n.data.state === 'proposed')
          .map((n) => n.id)
      );
      return {
        nodes: state.nodes.filter((node) => node.data.state !== 'proposed'),
        edges: state.edges.filter(
          (edge) => !proposedIds.has(edge.source) && !proposedIds.has(edge.target)
        ),
      };
    }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        { ...connection, type: 'dataFlow', animated: true },
        state.edges
      ),
    })),
}));
