import type { Node, Edge } from '@xyflow/react';
import type { EditNodesPipelineContext } from '@/types';

export function buildEditNodesPipelineContext(
  nodes: Node[],
  edges: Edge[]
): EditNodesPipelineContext {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data as Record<string, unknown>,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

