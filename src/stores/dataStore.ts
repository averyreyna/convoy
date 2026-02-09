import { create } from 'zustand';
import type { Column, DataFrame } from '@/types';

export interface NodeDataPayload {
  rows: Record<string, unknown>[];
  columns: Column[];
  fileName: string;
  rowCount: number;
}

interface DataStore {
  // Data stored per node ID (DataSource-specific payload)
  nodeData: Record<string, NodeDataPayload>;

  // Generic DataFrame outputs per node (used by all nodes including DataSource)
  nodeOutputs: Record<string, DataFrame>;

  // DataSource operations
  setNodeData: (nodeId: string, data: NodeDataPayload) => void;
  getNodeData: (nodeId: string) => NodeDataPayload | undefined;
  removeNodeData: (nodeId: string) => void;

  // Generic output operations
  setNodeOutput: (nodeId: string, data: DataFrame) => void;
  getNodeOutput: (nodeId: string) => DataFrame | undefined;
  removeNodeOutput: (nodeId: string) => void;
  clearNodeOutputs: () => void;
}

export const useDataStore = create<DataStore>((set, get) => ({
  nodeData: {},
  nodeOutputs: {},

  setNodeData: (nodeId, data) =>
    set((state) => ({
      nodeData: { ...state.nodeData, [nodeId]: data },
    })),

  getNodeData: (nodeId) => get().nodeData[nodeId],

  removeNodeData: (nodeId) =>
    set((state) => {
      const { [nodeId]: _, ...rest } = state.nodeData;
      return { nodeData: rest };
    }),

  setNodeOutput: (nodeId, data) =>
    set((state) => ({
      nodeOutputs: { ...state.nodeOutputs, [nodeId]: data },
    })),

  getNodeOutput: (nodeId) => get().nodeOutputs[nodeId],

  removeNodeOutput: (nodeId) =>
    set((state) => {
      const { [nodeId]: _, ...rest } = state.nodeOutputs;
      return { nodeOutputs: rest };
    }),

  clearNodeOutputs: () => set({ nodeOutputs: {} }),
}));
