import { memo, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { diffLines, type Change } from 'diff';
import { ChevronDown, ChevronRight, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
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

/* Rounded rect path (inset by 2px) for perimeter stroke; pathLength=100 for dashoffset animation */
const ROUNDED_RECT_PATH =
  'M 10 2 L 90 2 Q 98 2 98 10 L 98 90 Q 98 98 90 98 L 10 98 Q 2 98 2 90 L 2 10 Q 2 2 10 2';

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
        'group relative rounded-lg border-2 bg-white shadow-md transition-all hover:shadow-lg',
        wide ? 'min-w-[520px] max-w-[580px]' : 'min-w-[300px] max-w-[340px]',
        {
          'border-dashed border-gray-300 opacity-60': state === 'proposed',
          'border-solid border-gray-200': state === 'confirmed',
          'border-solid border-red-400 shadow-red-100': state === 'error',
          'animate-pulse border-blue-400 shadow-blue-100': state === 'running',
        }
      )}
    >
      {/* Selected: subtle blue outline (design-language blue) */}
      {selected && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={ROUNDED_RECT_PATH}
            pathLength={100}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="6 94"
            strokeLinecap="round"
            className="node-selection-stroke"
          />
        </svg>
      )}

      {/* Input handle */}
      {inputs > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-blue-500"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <span className="flex items-center text-gray-500">{icon}</span>
        <span className="text-sm font-medium text-gray-800">{title}</span>
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
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              Proposed
            </span>
          )}
          {state === 'error' && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
              Error
            </span>
          )}
        </div>
      </div>

      {/* Content: config/simple view only; code editing is in the pipeline code view */}
      <div className="p-3">
        {state === 'error' && errorMessage && (
          <div className="mb-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {errorMessage}
          </div>
        )}
        {children}
      </div>

      {/* Confirm button for proposed nodes */}
      {state === 'proposed' && onConfirm && (
        <div className="border-t border-gray-100 px-3 py-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="w-full rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          >
            Click to confirm
          </button>
        </div>
      )}

      {/* Inline diff: compact strip when baseline exists and differs */}
      {hasInlineDiff && (
        <div className="border-t border-gray-100 bg-gray-50/80">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDiffExpanded((x) => !x);
            }}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[10px] font-medium text-gray-600 hover:bg-gray-100"
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
            <div className="max-h-32 overflow-auto border-t border-gray-100 px-3 py-2 font-mono text-[10px]">
              {configChanged && (
                <div className="mb-2">
                  <div className="mb-0.5 text-gray-500">Config</div>
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
                  <div className="mb-0.5 text-gray-500">Code</div>
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
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-blue-500"
        />
      )}
    </div>
  );
});
