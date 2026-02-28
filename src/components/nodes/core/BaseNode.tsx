import { memo } from 'react';
import type { ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Square, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import {
  card,
  nodeHeader,
  nodeHeaderTitle,
  nodeHandle,
  button,
  badge,
  alert,
  panelSectionHeader,
  divider,
} from '@/flank';
import { ExplanationPopover } from './ExplanationPopover';

export type NodeState = 'proposed' | 'confirmed' | 'running' | 'error';

interface BaseNodeProps {
  /** Node id (for inline diff baseline lookup) */
  nodeId?: string;
  state: NodeState;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  inputs?: number;
  outputs?: number;
  onConfirm?: () => void;
  /** Node type identifier for AI explanation (e.g. 'filter', 'groupBy') */
  nodeType?: string;
  /** Node configuration for AI explanation and code generation */
  nodeConfig?: Record<string, unknown>;
  /** Input row count for AI explanation context */
  inputRowCount?: number;
  /** Output row count for AI explanation context */
  outputRowCount?: number;
  /** User's custom code (for inline diff baseline comparison; editing is in pipeline code view) */
  customCode?: string;
  /** If true, the node uses a wider layout (e.g. for chart rendering). */
  wide?: boolean;
  /** Execution error message to show when state is 'error' */
  errorMessage?: string;
  /** Whether the node is selected on the canvas */
  selected?: boolean;
}

export const BaseNode = memo(function BaseNode({
  nodeId,
  state,
  title,
  icon,
  children,
  inputs = 1,
  outputs = 1,
  onConfirm,
  nodeType,
  nodeConfig,
  inputRowCount,
  outputRowCount,
  customCode,
  wide,
  errorMessage,
  selected,
}: BaseNodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const setSelectedNodeIds = useCanvasStore((s) => s.setSelectedNodeIds);

  const showExplanation = state === 'confirmed' && nodeType && nodeConfig;

  return (
    <div
      className={cn(
        'group relative',
        card.base,
        card.stateVariants[state],
        selected && card.selected,
        wide && card.wide
      )}
    >
      {/* Input handle */}
      {inputs > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className={nodeHandle}
        />
      )}

      {/* Header */}
      <div className={nodeHeader}>
        {nodeId != null ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
              const next = selectedIds.includes(nodeId)
                ? selectedIds.filter((id) => id !== nodeId)
                : [...selectedIds, nodeId];
              setSelectedNodeIds(next);
            }}
            className="flex items-center text-gray-500 transition-colors hover:text-gray-700"
            title={selected ? 'Remove from selection' : 'Add to selection'}
            aria-label={selected ? 'Remove from selection' : 'Add to selection'}
          >
            {selected ? (
              <CheckSquare size={18} className="text-blue-500" />
            ) : (
              <Square size={18} className="text-gray-500" />
            )}
          </button>
        ) : (
          <span className="flex items-center text-gray-500">
            <Square size={18} />
          </span>
        )}
        <span className={nodeHeaderTitle}>{title}</span>
        <div className="ml-auto flex items-center gap-1">
          {showExplanation && (
            <ExplanationPopover
              nodeType={nodeType}
              nodeConfig={nodeConfig}
              inputRowCount={inputRowCount}
              outputRowCount={outputRowCount}
            />
          )}
          {state === 'proposed' && (
            <span className={cn(badge.base, badge.variants.proposed)}>Proposed</span>
          )}
          {state === 'error' && (
            <span className={cn(badge.base, badge.variants.error)}>Error</span>
          )}
        </div>
      </div>

      {/* Content: config/simple view only; code editing is in the pipeline code view */}
      <div className="p-3">
        {state === 'error' && errorMessage && (
          <div className={alert}>{errorMessage}</div>
        )}
        {children}
      </div>

      {/* Confirm button for proposed nodes */}
      {state === 'proposed' && onConfirm && (
        <div className={cn(divider, panelSectionHeader)}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className={cn(button.base, button.variants.primary, button.sizes.md, button.fullWidth)}
          >
            Click to confirm
          </button>
        </div>
      )}

      {/* Output handle */}
      {outputs > 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className={nodeHandle}
        />
      )}
    </div>
  );
});
