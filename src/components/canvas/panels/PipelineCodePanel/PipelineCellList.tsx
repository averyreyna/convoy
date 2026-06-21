import type { Node } from '@xyflow/react';
import type { Change } from 'diff';
import { diffLines } from 'diff';
import { ChevronDown, ChevronRight, Play, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Schema, SchemaDiagnostic } from '@/lib/inferSchema';
import { unknownSchema } from '@/lib/inferSchema';
import type { CellLiveEval } from '@/lib/liveEval';
import { useCanvasStore } from '@/stores/canvasStore';
import { PipelineCellEditor } from './PipelineCellEditor';
import {
  button,
  caption,
  label,
  notebookCell,
  notebookCellContent,
  notebookCellFocused,
  notebookCellGutter,
  notebookCellHeader,
  notebookCellHovered,
  notebookCellList,
  notebookCellPrompt,
  notebookCellSelected,
  notebookCellStale,
} from '@/flank';

export type PipelineCellKind = 'code' | 'aiConversation';

export interface CodePipelineCellViewModel {
  kind: 'code';
  nodeId: string;
  nodeType: string;
  label: string;
  code: string;
  /** Index into the ordered list of runnable code cells (for Run cell / Run all). */
  runIndex: number;
}

export interface AiConversationCellViewModel {
  kind: 'aiConversation';
  id: string;
  label: string;
  question: string;
  answer: string;
}

export type PipelineCellViewModel = CodePipelineCellViewModel | AiConversationCellViewModel;

interface BaselineSnapshot {
  config: Record<string, unknown>;
  customCode?: string;
}

interface PipelineCellListProps {
  cells: PipelineCellViewModel[];
  nodes: Node[];
  diagnosticsByCellId: Map<string, SchemaDiagnostic[]>;
  inputSchemaByCellId: Map<string, Schema>;
  evalStateByCellId: Map<string, CellLiveEval>;
  baselineByNodeId: Record<string, BaselineSnapshot>;
  selectedNodeIds: Set<string>;
  focusedCellNodeId: string | null;
  isRunning: boolean;
  expandedDiffCellIds: Set<string>;
  onCellClick: (event: React.MouseEvent, cell: PipelineCellViewModel, index: number) => void;
  onRunCell: (index: number) => void;
  onToggleCellDiff: (nodeId: string) => void;
  onActivateCell: (nodeId: string) => void;
  onClearFocusedCell: () => void;
  onCellCodeChange: (nodeId: string, code: string) => void;
  onRevertCell?: (nodeId: string) => void;
  onAcceptAsBaseline?: (nodeId: string) => void;
  /** Materialize a draft cell as a typed node locally (no run). Drafts only. */
  onAddCellAsNode?: (draftId: string) => void;
}

export function PipelineCellList({
  cells,
  nodes,
  diagnosticsByCellId,
  inputSchemaByCellId,
  evalStateByCellId,
  baselineByNodeId,
  selectedNodeIds,
  focusedCellNodeId,
  isRunning,
  expandedDiffCellIds,
  onCellClick,
  onRunCell,
  onToggleCellDiff,
  onActivateCell,
  onClearFocusedCell,
  onCellCodeChange,
  onRevertCell,
  onAcceptAsBaseline,
  onAddCellAsNode,
}: PipelineCellListProps) {
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId);
  const staleNodeIds = useCanvasStore((s) => s.staleNodeIds);
  const setHoveredNodeId = useCanvasStore((s) => s.setHoveredNodeId);

  if (cells.length === 0) {
    return null;
  }

  return (
    <div className={notebookCellList}>
      {cells.map((cell, index) => {
        if (cell.kind === 'aiConversation') {
          return (
            <div
              key={cell.id}
              className={cn(
                notebookCell,
                'border-blue-50 bg-blue-50/40'
              )}
            >
              <div className={notebookCellGutter}>
                <span className={notebookCellPrompt}>In [{index + 1}]:</span>
              </div>
              <div className={notebookCellContent}>
                <div className={notebookCellHeader}>
                  <span className={label}>{cell.label}</span>
                </div>
                <div className="space-y-2 rounded-b-md border-0 border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-800">
                  {cell.question && (
                    <div>
                      <div className={cn(caption, 'mb-0.5 text-gray-500')}>Question</div>
                      <p className="whitespace-pre-wrap">{cell.question}</p>
                    </div>
                  )}
                  <div>
                    <div className={cn(caption, 'mb-0.5 text-gray-500')}>Answer</div>
                    <p className="whitespace-pre-wrap">{cell.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const isNodeBacked = !cell.nodeId.startsWith('draft-');
        const isSelected = isNodeBacked && selectedNodeIds.has(cell.nodeId);
        const isFocused = focusedCellNodeId === cell.nodeId;
        const isHovered = isNodeBacked && hoveredNodeId === cell.nodeId;
        const isStale = isNodeBacked && !!staleNodeIds[cell.nodeId];
        const diagnostics = diagnosticsByCellId.get(cell.nodeId) ?? [];
        const node = isNodeBacked ? nodes.find((n) => n.id === cell.nodeId) : null;
        const baseline = isNodeBacked && node ? baselineByNodeId[cell.nodeId] : undefined;

        const configSnapshot = (d: Record<string, unknown> | undefined) => {
          if (!d) return '';
          const c = { ...d };
          delete c.state;
          delete c.label;
          delete c.error;
          delete c.inputRowCount;
          delete c.outputRowCount;
          delete c.isCodeMode;
          delete c.customCode;
          return JSON.stringify(
            Object.keys(c)
              .sort()
              .map((k) => [k, c[k]])
          );
        };

        const configChanged =
          !!baseline &&
          !!node &&
          configSnapshot(baseline.config) !== configSnapshot(node.data as Record<string, unknown>);
        const codeChanged =
          !!baseline &&
          (baseline.customCode ?? '') !==
            ((node?.data as { customCode?: string })?.customCode ?? '');
        const hasCellDiff = !!baseline && (configChanged || codeChanged);
        const cellDiffExpanded = expandedDiffCellIds.has(cell.nodeId);
        const cellCodeDiffLines =
          hasCellDiff && codeChanged && baseline
            ? (diffLines(
                baseline.customCode ?? '',
                (node?.data as { customCode?: string })?.customCode ?? ''
              ) as Change[])
            : null;

        return (
          <div
            key={cell.nodeId}
            role="button"
            tabIndex={-1}
            onClick={(e) => onCellClick(e, cell, index)}
            onMouseEnter={() => isNodeBacked && setHoveredNodeId(cell.nodeId)}
            onMouseLeave={() => isNodeBacked && setHoveredNodeId(null)}
            className={cn(
              notebookCell,
              isStale && notebookCellStale,
              isFocused && notebookCellFocused,
              isSelected && notebookCellSelected,
              isHovered && notebookCellHovered
            )}
          >
            <div className={notebookCellGutter}>
              <span className={notebookCellPrompt}>In [{index + 1}]:</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunCell(cell.runIndex);
                }}
                disabled={isRunning}
                className={cn(
                  button.base,
                  button.variants.ghost,
                  'rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50'
                )}
                title="Run up to this cell and propose nodes"
                aria-label="Run cell"
              >
                <Play size={10} />
              </button>
              {!isNodeBacked && onAddCellAsNode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddCellAsNode(cell.nodeId);
                  }}
                  className={cn(
                    button.base,
                    button.variants.ghost,
                    'rounded p-0.5 text-indigo-600 hover:bg-indigo-50'
                  )}
                  title="Add as a typed node — no run"
                  aria-label="Add as node"
                >
                  <Workflow size={10} />
                </button>
              )}
            </div>
            <div className={notebookCellContent}>
              <div className={notebookCellHeader}>
                <span className={label}>
                  {cell.label} ({cell.nodeType})
                </span>
              </div>
              <PipelineCellEditor
                cellId={cell.nodeId}
                code={cell.code}
                nodeType={cell.nodeType}
                diagnostics={diagnostics}
                inputSchema={inputSchemaByCellId.get(cell.nodeId) ?? unknownSchema}
                evalState={evalStateByCellId.get(cell.nodeId)}
                onActivateCell={() => onActivateCell(cell.nodeId)}
                onClearFocusedCell={onClearFocusedCell}
                onCodeChange={(value) => onCellCodeChange(cell.nodeId, value)}
              />
              {hasCellDiff && (
                <div className="border-t border-gray-100 bg-gray-50/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCellDiff(cell.nodeId);
                    }}
                    className={cn(
                      button.base,
                      button.variants.ghost,
                      button.sizes.sm,
                      'w-full justify-start gap-1 text-left font-normal'
                    )}
                  >
                    {cellDiffExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className={caption}>Changed since last run</span>
                  </button>
                  {cellDiffExpanded && (
                    <div className="px-2 pb-2">
                      {(onRevertCell || onAcceptAsBaseline) && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {onRevertCell && baseline && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRevertCell(cell.nodeId);
                              }}
                              className={cn(
                                button.base,
                                button.variants.ghost,
                                button.sizes.sm,
                                'text-gray-700 hover:bg-gray-200'
                              )}
                              title="Restore this cell to the last run state"
                              aria-label="Revert to last run"
                            >
                              Revert to last run
                            </button>
                          )}
                          {onAcceptAsBaseline && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAcceptAsBaseline(cell.nodeId);
                              }}
                              className={cn(
                                button.base,
                                button.variants.ghost,
                                button.sizes.sm,
                                'text-gray-700 hover:bg-gray-200'
                              )}
                              title="Set current state as the new baseline for this cell"
                              aria-label="Accept as baseline"
                            >
                              Accept as baseline
                            </button>
                          )}
                        </div>
                      )}
                      <div className="max-h-32 overflow-auto font-mono text-[10px]">
                      {configChanged && baseline && (
                        <div className="mb-2">
                          <div className={cn('mb-0.5', caption)}>Config</div>
                          <div className="rounded bg-red-50 px-1.5 py-0.5 text-red-800 line-through">
                            {JSON.stringify(baseline.config)}
                          </div>
                          <div className="mt-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                            {JSON.stringify(
                              node?.data && typeof node.data === 'object' ? node.data : {}
                            )}
                          </div>
                        </div>
                      )}
                      {cellCodeDiffLines && (
                        <div>
                          <div className={cn('mb-0.5', caption)}>Code</div>
                          <div className="space-y-0.5">
                            {cellCodeDiffLines.flatMap((change, i) => {
                              const lines = change.value.split('\n');
                              if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
                              return lines.map((line, j) => (
                                <div
                                  key={`${i}-${j}`}
                                  className={cn(
                                    'rounded px-1.5 py-0.5',
                                    change.added && 'bg-emerald-50 text-emerald-800',
                                    change.removed && 'bg-red-50 text-red-800 line-through',
                                    !change.added &&
                                      !change.removed &&
                                      'text-gray-600'
                                  )}
                                >
                                  {line || ' '}
                                </div>
                              ));
                            })}
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
