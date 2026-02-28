import { useMemo, useCallback } from 'react';
import type { EditNodesPipelineContext, EditNodesSchema } from '@/types';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';

/**
 * Returns the IDs of nodes that feed into the given node via incoming edges.
 */
export function useNodeContext(nodeId: string): string[] {
  const edges = useCanvasStore((s) => s.edges);

  return useMemo(
    () => edges.filter((e) => e.target === nodeId).map((e) => e.source),
    [edges, nodeId]
  );
}

/**
 * Returns a simple schema derived from the first confirmed dataSource node, if any.
 */
export function useDataSourceSchema(): EditNodesSchema | null {
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeData = useDataStore((s) => s.nodeData);

  return useMemo(() => {
    const dataSourceNode = nodes.find(
      (n) => n.type === 'dataSource' && (n.data as { state?: string })?.state === 'confirmed'
    );
    if (!dataSourceNode) return null;
    const d = nodeData[dataSourceNode.id];
    if (!d?.columns) return null;
    return { columns: d.columns };
  }, [nodes, nodeData]);
}

/**
 * Builds the pipeline context expected by AI routes from the current canvas state.
 */
export function usePipelineContext(): EditNodesPipelineContext {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  return useMemo(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
    [nodes, edges]
  );
}

/**
 * Typed helper around canvasStore.updateNode for node data updates.
 */
export function useNodeUpdate<TData extends object = Record<string, unknown>>(nodeId: string) {
  const updateNode = useCanvasStore((s) => s.updateNode);

  return useCallback(
    (partial: Partial<TData>) => {
      updateNode(nodeId, partial as Partial<Record<string, unknown>>);
    },
    [nodeId, updateNode]
  );
}

