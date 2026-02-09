import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import type { DataFrame } from '@/types';

/**
 * Hook that retrieves the output data from the upstream node
 * connected to the given node's input handle.
 *
 * Follows the incoming edge to find the source node, then
 * looks up that node's output in the data store.
 */
export function useUpstreamData(nodeId: string): DataFrame | undefined {
  const edges = useCanvasStore((s) => s.edges);
  const nodeOutputs = useDataStore((s) => s.nodeOutputs);

  // Find the edge where this node is the target (incoming data)
  const incomingEdge = edges.find((e) => e.target === nodeId);
  if (!incomingEdge) return undefined;

  return nodeOutputs[incomingEdge.source];
}
