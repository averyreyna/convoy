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
  // Select just this node's incoming source id (a primitive) rather than the
  // whole edges array, so the node only re-renders when its own upstream link
  // changes — not on every unrelated edge add/remove/select.
  const sourceId = useCanvasStore((s) => s.edges.find((e) => e.target === nodeId)?.source);
  const upstreamOutput = useDataStore((s) =>
    sourceId != null ? s.nodeOutputs[sourceId] : undefined
  );
  return upstreamOutput;
}
