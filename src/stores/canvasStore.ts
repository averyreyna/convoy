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
import type { ProposedPipeline, SuggestedPipelineNode } from '@/types';
import { topologicalSortPipeline } from '@/lib/exportPipeline';
import { usePreferencesStore } from './preferencesStore';

export interface ApplyImportOptions {
  /** When set (Run cell at index K), only update existing nodes at indices 0..K. */
  upToIndex?: number;
}

export type BaselineLanguage = 'python';

interface CanvasStore {
  nodes: Node[];
  edges: Edge[];

  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;

  showPrompt: boolean;
  setShowPrompt: (show: boolean) => void;

  // Baseline (for diff viewer): set on import or "Pin current"
  baselineCode: string | null;
  baselineLanguage: BaselineLanguage | null;
  setBaselineFromImport: (code: string, language: BaselineLanguage) => void;
  setBaselineFromPin: (code: string, language: BaselineLanguage) => void;
  clearBaseline: () => void;

  // Per-node baseline for inline diff: "Pin selection" writes selected nodes' config/code here
  baselineByNodeId: Record<string, { config: Record<string, unknown>; customCode?: string }>;
  setBaselineForSelection: () => void;
  setBaselineForNodeIds: (nodeIds: string[]) => void;
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
  applyImportToExistingPipeline: (pipeline: ProposedPipeline, options?: ApplyImportOptions) => void;
  replaceNodesWithSuggestedPipeline: (nodeIdsToReplace: string[], suggested: { nodes: SuggestedPipelineNode[] }, options?: { insertAfterNodeId?: string }) => void;
  confirmAllProposed: () => void;
  clearProposed: () => void;

  // Snap code panel focus to canvas: when a code cell is focused, request viewport to fit this node
  focusNodeIdForView: string | null;
  setFocusNodeIdForView: (id: string | null) => void;

  // Selection (canvas + code panel): set selected node IDs so both surfaces stay in sync
  setSelectedNodeIds: (nodeIds: string[]) => void;

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

  showPrompt: false,
  setShowPrompt: (show) => set({ showPrompt: show }),

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
  setBaselineForNodeIds: (nodeIds) =>
    set((state) => {
      if (nodeIds.length === 0) return state;
      const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
      const next: Record<string, { config: Record<string, unknown>; customCode?: string }> = {
        ...state.baselineByNodeId,
      };
      for (const id of nodeIds) {
        const node = nodeMap.get(id);
        if (!node) continue;
        const data = (node.data || {}) as Record<string, unknown>;
        const { state: _nodeState, label: _l, error: _e, inputRowCount: _i, outputRowCount: _o, ...config } = data;
        next[id] = {
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

  applyImportToExistingPipeline: (pipeline, options) => {
    const { nodes: existingNodes, edges: existingEdges } = get();
    const pipelineNodes = pipeline.nodes || [];
    if (pipelineNodes.length === 0) return;

    const orderedNodes = topologicalSortPipeline(existingNodes, existingEdges);
    if (orderedNodes.length === 0) return;

    const upToIndex = options?.upToIndex;
    const updateLimit =
      upToIndex !== undefined
        ? Math.min(pipelineNodes.length, orderedNodes.length, upToIndex + 1)
        : Math.min(pipelineNodes.length, orderedNodes.length);

    const showCodeByDefault = usePreferencesStore.getState().showCodeByDefault;

    const updatedNodes = existingNodes.map((node) => {
      const idx = orderedNodes.findIndex((n) => n.id === node.id);
      if (idx < 0 || idx >= updateLimit) return node;
      const imp = pipelineNodes[idx];
      const type = imp.type;
      const config = (imp.config || {}) as Record<string, unknown>;
      const supportsCodeMode = type !== 'dataSource' && type !== 'transform';
      const data = { ...node.data, ...config } as Record<string, unknown>;
      if ((node.data as Record<string, unknown>)?.state !== undefined)
        data.state = (node.data as Record<string, unknown>).state;
      if ((node.data as Record<string, unknown>)?.label !== undefined)
        data.label = (node.data as Record<string, unknown>).label;
      if ((node.data as Record<string, unknown>)?.isCodeMode !== undefined)
        data.isCodeMode = (node.data as Record<string, unknown>).isCodeMode;
      if (data.label === undefined)
        data.label = type.charAt(0).toUpperCase() + type.slice(1);
      if (data.isCodeMode === undefined && supportsCodeMode)
        data.isCodeMode = showCodeByDefault;
      return { ...node, type, data };
    });

    if (
      upToIndex === undefined &&
      pipelineNodes.length > orderedNodes.length
    ) {
      const lastNode = orderedNodes[orderedNodes.length - 1];
      let xOffset = lastNode.position.x + 320;
      const yPos = lastNode.position.y;
      let previousNodeId = lastNode.id;
      const timestamp = Date.now();
      const appendNodes: Node[] = [];
      const appendEdges: Edge[] = [];
      const toAdd = pipelineNodes.slice(orderedNodes.length);

      toAdd.forEach((nodeConfig, index) => {
        const nodeId = `import-${timestamp}-${index}`;
        const type = nodeConfig.type;
        const supportsCodeMode =
          type !== 'dataSource' && type !== 'transform';
        appendNodes.push({
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
        appendEdges.push({
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
        nodes: [...updatedNodes, ...appendNodes],
        edges: [...existingEdges, ...appendEdges],
      });
    } else {
      set({ nodes: updatedNodes });
    }
  },

  replaceNodesWithSuggestedPipeline: (nodeIdsToReplace, suggested, options) => {
    const { nodes: existingNodes, edges: existingEdges } = get();
    const suggestedNodes = suggested?.nodes ?? [];
    if (suggestedNodes.length === 0) return;

    const insertAfterNodeId = options?.insertAfterNodeId;
    const isInsertMode = nodeIdsToReplace.length === 0 && insertAfterNodeId;

    let toReplace: Set<string>;
    let upstreamIds: string[];
    let downstreamIds: string[];
    let nodesAfterRemoval: Node[];
    let edgesAfterRemoval: Edge[];
    let basePosition: { x: number; y: number };

    if (isInsertMode) {
      toReplace = new Set();
      const outgoingFromInsert = existingEdges.filter((e) => e.source === insertAfterNodeId);
      downstreamIds = [...new Set(outgoingFromInsert.map((e) => e.target))];
      upstreamIds = [insertAfterNodeId];
      nodesAfterRemoval = existingNodes;
      edgesAfterRemoval = existingEdges.filter(
        (e) => !(e.source === insertAfterNodeId && downstreamIds.includes(e.target))
      );
      const insertNode = existingNodes.find((n) => n.id === insertAfterNodeId);
      basePosition = insertNode
        ? { x: insertNode.position.x + 320, y: insertNode.position.y }
        : { x: 120, y: 120 };
    } else {
      toReplace = new Set(nodeIdsToReplace);
      const incomingEdges = existingEdges.filter((e) => toReplace.has(e.target));
      const outgoingEdges = existingEdges.filter((e) => toReplace.has(e.source));
      upstreamIds = [...new Set(incomingEdges.map((e) => e.source))].filter((id) => !toReplace.has(id));
      downstreamIds = [...new Set(outgoingEdges.map((e) => e.target))].filter((id) => !toReplace.has(id));
      nodesAfterRemoval = existingNodes.filter((n) => !toReplace.has(n.id));
      edgesAfterRemoval = existingEdges.filter(
        (e) => !toReplace.has(e.source) && !toReplace.has(e.target)
      );
      const firstRemoved = existingNodes.find((n) => toReplace.has(n.id));
      const firstUpstream = upstreamIds.length > 0 ? existingNodes.find((n) => n.id === upstreamIds[0]) : null;
      basePosition = firstRemoved
        ? { x: firstRemoved.position.x, y: firstRemoved.position.y }
        : firstUpstream
          ? { x: firstUpstream.position.x + 320, y: firstUpstream.position.y }
          : { x: 120, y: 120 };
    }

    const showCodeByDefault = usePreferencesStore.getState().showCodeByDefault;
    const validTypes = new Set(['dataSource', 'filter', 'groupBy', 'sort', 'select', 'chart', 'computedColumn', 'reshape', 'transform']);
    const timestamp = Date.now();
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let xOffset = basePosition.x;
    const yPos = basePosition.y;
    let previousNodeId: string | null = upstreamIds.length > 0 ? upstreamIds[0] : null;

    for (let i = 0; i < suggestedNodes.length; i++) {
      const spec = suggestedNodes[i];
      const nodeType = spec.type && validTypes.has(spec.type) ? spec.type : 'transform';
      const supportsCodeMode = nodeType !== 'dataSource' && nodeType !== 'transform';
      const nodeId = `ai-${timestamp}-${i}`;

      const data: Record<string, unknown> = {
        state: 'confirmed' as const,
        label: spec.label ?? nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        ...(spec.config ?? {}),
        ...(spec.customCode !== undefined && spec.customCode !== '' ? { customCode: spec.customCode } : {}),
        ...(supportsCodeMode ? { isCodeMode: showCodeByDefault } : {}),
      };

      newNodes.push({
        id: nodeId,
        type: nodeType,
        position: { x: xOffset, y: yPos },
        data,
      });

      if (previousNodeId) {
        newEdges.push({
          id: `edge-${previousNodeId}-${nodeId}`,
          source: previousNodeId,
          target: nodeId,
          type: 'dataFlow',
          animated: true,
        });
      }
      previousNodeId = nodeId;
      xOffset += 320;
    }

    if (previousNodeId) {
      for (const targetId of downstreamIds) {
        newEdges.push({
          id: `edge-${previousNodeId}-${targetId}`,
          source: previousNodeId,
          target: targetId,
          type: 'dataFlow',
          animated: true,
        });
      }
    }

    set({
      nodes: [...nodesAfterRemoval, ...newNodes],
      edges: [...edgesAfterRemoval, ...newEdges],
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

  focusNodeIdForView: null,
  setFocusNodeIdForView: (id) => set({ focusNodeIdForView: id }),

  setSelectedNodeIds: (nodeIds) =>
    set((state) => ({
      nodes: state.nodes.map((node) => ({
        ...node,
        selected: nodeIds.includes(node.id),
      })),
    })),

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
