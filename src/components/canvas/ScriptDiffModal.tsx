import { useMemo, useEffect, useCallback } from 'react';
import { diffLines, type Change } from 'diff';
import { X, Pin, Trash2 } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { exportAsPython } from '@/lib/exportPipeline';

const PLACEHOLDER = 'No baseline—import code or pin current';

interface ScriptDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DiffRow =
  | { kind: 'unchanged'; leftNum: number; rightNum: number; text: string }
  | { kind: 'removed'; leftNum: number; text: string }
  | { kind: 'added'; rightNum: number; text: string };

function buildDiffRows(baseline: string, current: string): DiffRow[] {
  const changes = diffLines(baseline, current) as Change[];
  const rows: DiffRow[] = [];
  let leftNum = 1;
  let rightNum = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();

    for (const line of lines) {
      if (change.added) {
        rows.push({ kind: 'added', rightNum: rightNum++, text: line });
      } else if (change.removed) {
        rows.push({ kind: 'removed', leftNum: leftNum++, text: line });
      } else {
        rows.push({
          kind: 'unchanged',
          leftNum: leftNum++,
          rightNum: rightNum++,
          text: line,
        });
      }
    }
  }

  return rows;
}

export function ScriptDiffModal({ isOpen, onClose }: ScriptDiffModalProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const baselineCode = useCanvasStore((s) => s.baselineCode);
  const setBaselineFromPin = useCanvasStore((s) => s.setBaselineFromPin);
  const clearBaseline = useCanvasStore((s) => s.clearBaseline);

  const currentExport = useMemo(() => {
    if (nodes.length === 0) return '';
    return exportAsPython(nodes, edges);
  }, [nodes, edges]);

  const leftText = baselineCode ?? '';
  const rightText = currentExport;
  const hasBaseline = baselineCode != null && baselineCode.length > 0;

  const diffRows = useMemo(() => {
    if (!hasBaseline) return null;
    return buildDiffRows(leftText, rightText);
  }, [leftText, rightText, hasBaseline]);

  const handlePinCurrent = useCallback(() => {
    if (currentExport) {
      setBaselineFromPin(currentExport, 'python');
    }
  }, [currentExport, setBaselineFromPin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">Code changes</h2>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Python
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePinCurrent}
              disabled={!currentExport}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              title="Set baseline to current export"
            >
              <Pin size={14} />
              Pin current
            </button>
            {hasBaseline && (
              <button
                onClick={() => clearBaseline()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
                title="Clear baseline"
              >
                <Trash2 size={14} />
                Clear baseline
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-px overflow-hidden border-t border-gray-200 bg-gray-200">
          {/* Before (baseline) */}
          <div className="flex flex-col bg-gray-50">
            <div className="border-b border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
              Before (baseline)
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-xs">
              {!hasBaseline ? (
                <p className="text-gray-400">{PLACEHOLDER}</p>
              ) : diffRows ? (
                <div className="min-h-full">
                  {diffRows.map((row, i) => {
                    if (row.kind === 'removed') {
                      return (
                        <div
                          key={`l-${i}`}
                          className="flex border-l-2 border-red-400 bg-red-50 py-0.5 pl-2 pr-2 text-red-900"
                        >
                          <span className="select-none pr-2 text-gray-400">{row.leftNum}</span>
                          <span className="break-all">{row.text || ' '}</span>
                        </div>
                      );
                    }
                    if (row.kind === 'unchanged') {
                      return (
                        <div key={`l-${i}`} className="flex py-0.5 pl-2 pr-2 text-gray-800">
                          <span className="select-none pr-2 text-gray-400">{row.leftNum}</span>
                          <span className="break-all">{row.text || ' '}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={`l-${i}`} className="flex py-0.5 pl-2 pr-2 text-gray-300">
                        <span className="pr-2"> </span>
                        <span> </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-gray-800">{leftText}</pre>
              )}
            </div>
          </div>

          {/* After (current export) */}
          <div className="flex flex-col bg-gray-50">
            <div className="border-b border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
              After (current)
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-xs">
              {diffRows ? (
                <div className="min-h-full">
                  {diffRows.map((row, i) => {
                    if (row.kind === 'added') {
                      return (
                        <div
                          key={`r-${i}`}
                          className="flex border-l-2 border-emerald-500 bg-emerald-50 py-0.5 pl-2 pr-2 text-emerald-900"
                        >
                          <span className="select-none pr-2 text-gray-400">{row.rightNum}</span>
                          <span className="break-all">{row.text || ' '}</span>
                        </div>
                      );
                    }
                    if (row.kind === 'unchanged') {
                      return (
                        <div key={`r-${i}`} className="flex py-0.5 pl-2 pr-2 text-gray-800">
                          <span className="select-none pr-2 text-gray-400">{row.rightNum}</span>
                          <span className="break-all">{row.text || ' '}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={`r-${i}`} className="flex py-0.5 pl-2 pr-2 text-gray-300">
                        <span className="pr-2"> </span>
                        <span> </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-gray-800">
                  {rightText || '(no nodes to export)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
