import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeStatus } from '@/types';
import { useCanvasStore } from '@/stores/canvasStore';

function getEdgeStyleForStatus(
  status: EdgeStatus | undefined
): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  strokeOpacity?: number;
} {
  switch (status) {
    case 'running':
      return {
        stroke: '#3b82f6',
        strokeWidth: 2.5,
        strokeDasharray: '4 2',
        strokeOpacity: 1,
      };
    case 'error':
      return {
        stroke: '#ef4444',
        strokeWidth: 2.5,
        strokeOpacity: 1,
      };
    case 'proposed':
      return {
        stroke: '#3b82f6',
        strokeWidth: 2,
        strokeOpacity: 0.5,
      };
    case 'confirmed':
    default:
      return {
        stroke: '#6b7280',
        strokeWidth: 2,
        strokeOpacity: 0.9,
      };
  }
}

export function DataFlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const status = (data as { status?: EdgeStatus } | undefined)?.status;
  const baseStyle = getEdgeStyleForStatus(status);

  // Highlight edges touching the hovered node so the data path reads as connected.
  const isHovered = useCanvasStore(
    (s) => s.hoveredNodeId != null && (s.hoveredNodeId === source || s.hoveredNodeId === target)
  );
  const hoverStyle = isHovered ? { stroke: '#60a5fa', strokeWidth: 3, strokeOpacity: 1 } : null;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <BaseEdge
      id={id}
      className={`data-flow-edge${
        status ? ` data-flow-edge--${status}` : ''
      }`}
      data-status={status}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...baseStyle,
        ...style,
        ...hoverStyle,
      }}
    />
  );
}
