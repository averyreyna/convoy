import { memo, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { diffLines, type Change } from 'diff';
import { ChevronDown, ChevronRight, GitCompare, Square, CheckSquare } from 'lucide-react';
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
  caption,
  panelSection,
  panelSectionHeader,
  divider,
} from '@/design-system';
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

function configSnapshot(c: Record<string, unknown> | undefined): string {
  if (!c || typeof c !== 'object') return '';
  const keys = Object.keys(c).sort();
  return JSON.stringify(keys.map((k) => [k, c[k]]));
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
  const baselineByNodeId = useCanvasStore((s) => s.baselineByNodeId);
  const clearNodeBaseline = useCanvasStore((s) => s.clearNodeBaseline);
  const nodes = useCanvasStore((s) => s.nodes);
  const setSelectedNodeIds = useCanvasStore((s) => s.setSelectedNodeIds);

  const baseline = nodeId ? baselineByNodeId[nodeId] : undefined;
  const configChanged = useMemo(() => {
    if (!baseline || !nodeConfig) return false;
    return configSnapshot(baseline.config) !== configSnapshot(nodeConfig);
  }, [baseline, nodeConfig]);
  const codeChanged = useMemo(() => {
    if (!baseline) return false;
    const a = baseline.customCode ?? '';
    const b = customCode ?? '';
    return a !== b;
  }, [baseline, customCode]);
  const hasInlineDiff = baseline && (configChanged || codeChanged);

  const [diffExpanded, setDiffExpanded] = useState(false);
  const codeDiffLines = useMemo(() => {
    if (!hasInlineDiff || !codeChanged || !baseline) return null;
    const before = baseline.customCode ?? '';
    const after = customCode ?? '';
    return diffLines(before, after) as Change[];
  }, [hasInlineDiff, codeChanged, baseline, customCode]);

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

      {/* Inline diff: compact strip when baseline exists and differs */}
      {hasInlineDiff && (
        <div className={cn(divider, panelSectionHeader, 'bg-gray-50/80')}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDiffExpanded((x) => !x);
            }}
            className={cn(button.base, button.variants.ghost, button.sizes.sm, 'w-full justify-start text-left')}
          >
            {diffExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            <GitCompare size={12} className="text-violet-600" />
            <span>
              {configChanged && codeChanged
                ? 'Config & code changed'
                : configChanged
                  ? 'Config changed'
                  : 'Code changed'}
            </span>
          </button>
          {diffExpanded && (
            <div className={cn(divider, panelSectionHeader, 'max-h-32 overflow-auto font-mono text-[10px]')}>
              {configChanged && (
                <div className="mb-2">
                  <div className={cn('mb-0.5', caption)}>Config</div>
                  <div className="rounded bg-red-50 px-1.5 py-0.5 text-red-800 line-through">
                    {JSON.stringify(baseline.config)}
                  </div>
                  <div className="mt-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                    {JSON.stringify(nodeConfig)}
                  </div>
                </div>
              )}
              {codeChanged && codeDiffLines && (
                <div>
                  <div className={cn('mb-0.5', caption)}>Code</div>
                  <div className="space-y-0.5">
                    {codeDiffLines.flatMap((change, i) => {
                      const lines = change.value.split('\n');
                      if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
                      return lines.map((line, j) => (
                        <div
                          key={`c-${i}-${j}`}
                          className={cn(
                            'rounded px-1.5 py-0.5',
                            change.added && 'bg-emerald-50 text-emerald-800',
                            change.removed && 'bg-red-50 text-red-800 line-through',
                            !change.added && !change.removed && 'text-gray-600'
                          )}
                        >
                          {line || ' '}
                        </div>
                      ));
                    })}
                  </div>
                </div>
              )}
              {nodeId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearNodeBaseline(nodeId);
                  }}
                  className="mt-2 text-[10px] text-gray-500 underline hover:text-gray-700"
                >
                  Clear baseline for this node
                </button>
              )}
            </div>
          )}
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
