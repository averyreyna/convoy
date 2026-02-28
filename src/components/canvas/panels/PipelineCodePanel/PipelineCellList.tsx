import type { Node } from '@xyflow/react';
import type { Change } from 'diff';
import { diffLines } from 'diff';
import Editor from '@monaco-editor/react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  button,
  caption,
  label,
  notebookCell,
  notebookCellContent,
  notebookCellFocused,
  notebookCellGutter,
  notebookCellHeader,
  notebookCellList,
  notebookCellPrompt,
  notebookCellSelected,
} from '@/flank';

const MIN_EDITOR_HEIGHT = 52;
const MAX_EDITOR_HEIGHT = 168;

const EDITOR_OPTIONS = {
  readOnly: false,
  minimap: { enabled: false },
  fontSize: 10,
  lineNumbers: 'off' as const,
  folding: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 4, bottom: 4 },
  wordWrap: 'on' as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: 'auto' as const,
    horizontal: 'hidden' as const,
    verticalScrollbarSize: 6,
  },
} as const;

export interface PipelineCellViewModel {
  nodeId: string;
  nodeType: string;
  label: string;
  code: string;
}

interface BaselineSnapshot {
  config: Record<string, unknown>;
  customCode?: string;
}

interface PipelineCellListProps {
  cells: PipelineCellViewModel[];
  nodes: Node[];
  baselineByNodeId: Record<string, BaselineSnapshot>;
  selectedNodeIds: Set<string>;
  focusedCellNodeId: string | null;
  isRunning: boolean;
  expandedDiffCellIds: Set<string>;
  onCellClick: (event: React.MouseEvent, cell: { nodeId: string }, index: number) => void;
  onRunCell: (index: number) => void;
  onToggleCellDiff: (nodeId: string) => void;
  onActivateCell: (nodeId: string) => void;
  onClearFocusedCell: () => void;
  onCellCodeChange: (nodeId: string, code: string) => void;
}

export function PipelineCellList({
  cells,
  nodes,
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
}: PipelineCellListProps) {
  if (cells.length === 0) {
    return null;
  }

  return (
    <div className={notebookCellList}>
      {cells.map((cell, index) => {
        const isNodeBacked = !cell.nodeId.startsWith('draft-');
        const isSelected = isNodeBacked && selectedNodeIds.has(cell.nodeId);
        const isFocused = focusedCellNodeId === cell.nodeId;
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
            className={cn(
              notebookCell,
              isFocused && notebookCellFocused,
              isSelected && notebookCellSelected
            )}
          >
            <div className={notebookCellGutter}>
              <span className={notebookCellPrompt}>In [{index + 1}]:</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunCell(index);
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
            </div>
            <div className={notebookCellContent}>
              <div className={notebookCellHeader}>
                <span className={label}>
                  {cell.label} ({cell.nodeType})
                </span>
              </div>
              <div className="overflow-hidden rounded-b-md border-0 border-gray-200">
                <Editor
                  height={Math.min(
                    Math.max(MIN_EDITOR_HEIGHT, cell.code.split('\n').length * 16),
                    MAX_EDITOR_HEIGHT
                  )}
                  language="python"
                  value={cell.code}
                  onChange={(value) => onCellCodeChange(cell.nodeId, value ?? '')}
                  theme="vs-light"
                  options={EDITOR_OPTIONS}
                  onMount={(editor) => {
                    const disposableFocus = editor.onDidFocusEditorWidget(() =>
                      onActivateCell(cell.nodeId)
                    );
                    const disposableBlur = editor.onDidBlurEditorWidget(() =>
                      onClearFocusedCell()
                    );
                    return () => {
                      disposableFocus.dispose();
                      disposableBlur.dispose();
                    };
                  }}
                />
              </div>
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
                    <div className="max-h-32 overflow-auto px-2 pb-2 font-mono text-[10px]">
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
