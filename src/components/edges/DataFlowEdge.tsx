import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeStatus } from '@/types';

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
  const statusLabel =
    status === 'running'
      ? 'Running'
      : status === 'error'
        ? 'Error'
        : status === 'proposed'
          ? 'Proposed'
          : 'Confirmed';

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
      title={`${statusLabel} edge`}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...baseStyle,
        ...style,
      }}
    />
  );
}
