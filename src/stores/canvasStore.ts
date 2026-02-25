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
import { usePreferencesStore } from './preferencesStore';

export type BaselineLanguage = 'python';

interface CanvasStore {
  nodes: Node[];
  edges: Edge[];

  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;

  welcomeCardDismissed: boolean;
  dismissWelcomeCard: () => void;

  // Baseline (for diff viewer): set on import or "Pin current"
  baselineCode: string | null;
  baselineLanguage: BaselineLanguage | null;
  setBaselineFromImport: (code: string, language: BaselineLanguage) => void;
  setBaselineFromPin: (code: string, language: BaselineLanguage) => void;
  clearBaseline: () => void;

  // Per-node baseline for inline diff: "Pin selection" writes selected nodes' config/code here
  baselineByNodeId: Record<string, { config: Record<string, unknown>; customCode?: string }>;
  setBaselineForSelection: () => void;
  clearNodeBaseline: (nodeId: string) => void;
  clearAllNodeBaselines: () => void;

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
  setPipelineFromImport: (pipeline: ProposedPipeline) => void;
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

  showImportModal: false,
  setShowImportModal: (show) => set({ showImportModal: show }),

  welcomeCardDismissed: false,
  dismissWelcomeCard: () => set({ welcomeCardDismissed: true }),

  baselineCode: null,
  baselineLanguage: null,
  setBaselineFromImport: (code, language) =>
    set({ baselineCode: code, baselineLanguage: language }),
  setBaselineFromPin: (code, language) =>
    set({ baselineCode: code, baselineLanguage: language }),
  clearBaseline: () => set({ baselineCode: null, baselineLanguage: null }),

  baselineByNodeId: {},
  setBaselineForSelection: () =>
    set((state) => {
      const selected = state.nodes.filter((n) => n.selected);
      if (selected.length === 0) return state;
      const next: Record<string, { config: Record<string, unknown>; customCode?: string }> = {
        ...state.baselineByNodeId,
      };
      for (const node of selected) {
        const data = (node.data || {}) as Record<string, unknown>;
        const { state: _nodeState, label: _l, error: _e, inputRowCount: _i, outputRowCount: _o, ...config } = data;
        next[node.id] = {
          config: { ...config },
          customCode: typeof data.customCode === 'string' ? data.customCode : undefined,
        };
      }
      return { baselineByNodeId: next };
    }),
  clearNodeBaseline: (nodeId) =>
    set((state) => {
      const { [nodeId]: _, ...rest } = state.baselineByNodeId;
      return { baselineByNodeId: rest };
    }),
  clearAllNodeBaselines: () => set({ baselineByNodeId: {} }),

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
    set((state) => {
      const { [id]: _, ...baselineRest } = state.baselineByNodeId;
      return {
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
        baselineByNodeId: baselineRest,
      };
    }),

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
    const showCodeByDefault = usePreferencesStore.getState().showCodeByDefault;

    // Find DataSource node to connect to
    const dataSourceNode = existingNodes.find((n) => n.type === 'dataSource');
    if (!dataSourceNode) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let previousNodeId = dataSourceNode.id;
    let xOffset = dataSourceNode.position.x + 320;

    pipeline.nodes.forEach((nodeConfig, index) => {
      const nodeId = `proposed-${Date.now()}-${index}`;
      const type = nodeConfig.type;
      const supportsCodeMode =
        type !== 'dataSource' && type !== 'transform';

      newNodes.push({
        id: nodeId,
        type,
        position: { x: xOffset, y: dataSourceNode.position.y },
        data: {
          state: 'proposed' as const,
          label: type.charAt(0).toUpperCase() + type.slice(1),
          ...nodeConfig.config,
          ...(supportsCodeMode ? { isCodeMode: showCodeByDefault } : {}),
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

  setPipelineFromImport: (pipeline) => {
    const { nodes: existingNodes, edges: existingEdges } = get();
    const pipelineNodes = pipeline.nodes || [];
    if (pipelineNodes.length === 0) return;

    const showCodeByDefault = usePreferencesStore.getState().showCodeByDefault;
    const firstIsDataSource = pipelineNodes[0]?.type === 'dataSource';
    const existingDataSource = existingNodes.find((n) => n.type === 'dataSource');

    const basePosition = { x: 120, y: 120 };
    let xOffset = basePosition.x;
    const yPos = basePosition.y;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const timestamp = Date.now();

    let previousNodeId: string;

    if (firstIsDataSource && pipelineNodes[0]) {
      const dsConfig = pipelineNodes[0].config || {};
      const dsId = `import-${timestamp}-0`;
      newNodes.push({
        id: dsId,
        type: 'dataSource',
        position: { x: xOffset, y: yPos },
        data: {
          state: 'proposed' as const,
          label: 'Data Source',
          ...dsConfig,
        },
      });
      previousNodeId = dsId;
      xOffset += 320;
    } else if (existingDataSource) {
      previousNodeId = existingDataSource.id;
      xOffset = existingDataSource.position.x + 320;
    } else {
      const dsId = `import-${timestamp}-0`;
      newNodes.push({
        id: dsId,
        type: 'dataSource',
        position: { x: xOffset, y: yPos },
        data: {
          state: 'proposed' as const,
          label: 'Data Source',
        },
      });
      previousNodeId = dsId;
      xOffset += 320;
    }

    const nodesToAdd = firstIsDataSource ? pipelineNodes.slice(1) : pipelineNodes;
    nodesToAdd.forEach((nodeConfig, index) => {
      const nodeId = `import-${timestamp}-${index + (firstIsDataSource ? 1 : 0)}`;
      const type = nodeConfig.type;
      const supportsCodeMode =
        type !== 'dataSource' && type !== 'transform';

      newNodes.push({
        id: nodeId,
        type,
        position: { x: xOffset, y: yPos },
        data: {
          state: 'proposed' as const,
          label: type.charAt(0).toUpperCase() + type.slice(1),
          ...nodeConfig.config,
          ...(supportsCodeMode ? { isCodeMode: showCodeByDefault } : {}),
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
