import { useMemo, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateNodeCode } from '@/lib/codeGenerators';
import {
  topologicalSort,
  exportAsPython,
  buildScriptFromCellCodes,
  buildScriptForBrowserRun,
  downloadPipelineScript,
  downloadNotebook,
  copyAsJupyterCells,
} from '@/lib/exportPipeline';
import { runFullPipelineScript } from '@/lib/pythonRunner';
import { importPipelineFromPython } from '@/lib/api';
import { Copy, Download, FileCode, Play, Plus, Square, X } from 'lucide-react';

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
};

const MIN_EDITOR_HEIGHT = 52;
const MAX_EDITOR_HEIGHT = 168;

const DEFAULT_DRAFT_CODE = '# New step\ndf = df  # edit and run';

export function PipelineCodePanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const applyImportToExistingPipeline = useCanvasStore((s) => s.applyImportToExistingPipeline);
  const setPipelineFromImport = useCanvasStore((s) => s.setPipelineFromImport);
  const setFocusNodeIdForView = useCanvasStore((s) => s.setFocusNodeIdForView);
  const setSelectedNodeIds = useCanvasStore((s) => s.setSelectedNodeIds);

  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [focusedCellNodeId, setFocusedCellNodeId] = useState<string | null>(null);
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);
  const [draftCells, setDraftCells] = useState<Array<{ id: string; code: string }>>([]);
  const [copyFeedback, setCopyFeedback] = useState<'script' | 'jupyter' | null>(null);

  const activateCell = useCallback(
    (nodeId: string) => {
      setFocusedCellNodeId(nodeId);
      if (!nodeId.startsWith('draft-')) {
        setFocusNodeIdForView(nodeId);
      }
    },
    [setFocusNodeIdForView]
  );

  const handleAddCell = useCallback(() => {
    setDraftCells((prev) => [
      ...prev,
      { id: `draft-${Date.now()}`, code: DEFAULT_DRAFT_CODE },
    ]);
  }, []);

  const nodeCells = useMemo(() => {
    const sorted = topologicalSort(nodes, edges);
    return sorted.map((node) => {
      const data = node.data as Record<string, unknown>;
      const nodeType = (node.type as string) || 'unknown';
      const label = (data.label as string) || nodeType;
      const config = { ...data };
      delete config.state;
      delete config.label;
      delete config.isCodeMode;
      delete config.customCode;
      delete config.error;
      delete config.inputRowCount;
      delete config.outputRowCount;
      const code =
        typeof data.customCode === 'string' && data.customCode.trim() !== ''
          ? data.customCode
          : generateNodeCode(nodeType, config);
      return { nodeId: node.id, nodeType, label, code };
    });
  }, [nodes, edges]);

  const cells = useMemo(() => {
    const draftAsCells = draftCells.map((d) => ({
      nodeId: d.id,
      nodeType: 'transform' as const,
      label: 'New cell',
      code: d.code,
    }));
    return [...nodeCells, ...draftAsCells];
  }, [nodeCells, draftCells]);

  const fullScript = useMemo(
    () => (cells.length > 0 ? buildScriptFromCellCodes(cells) : ''),
    [cells]
  );

  const dataSourceColumnNames = useMemo(() => {
    const sorted = topologicalSort(nodes, edges);
    const dataSourceNode = sorted.find((n) => (n.type as string) === 'dataSource');
    const data = dataSourceNode?.data as { columns?: Array<{ name: string }> } | undefined;
    return data?.columns?.map((c) => c.name) ?? [];
  }, [nodes, edges]);

  const runScriptAndImport = useCallback(
    async (
      scriptForImport: string,
      scriptForRun: string,
      options?: { upToIndex?: number; clearDraftsOnSuccess?: boolean }
    ) => {
      setRunError(null);
      setIsRunning(true);
      try {
        await runFullPipelineScript(scriptForRun);
        const { pipeline } = await importPipelineFromPython(scriptForImport);
        if (nodes.length === 0) {
          setPipelineFromImport(pipeline);
          setDraftCells([]);
        } else {
          applyImportToExistingPipeline(
            pipeline,
            options?.upToIndex !== undefined ? { upToIndex: options.upToIndex } : undefined
          );
          if (options?.clearDraftsOnSuccess && draftCells.length > 0) {
            setDraftCells([]);
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : String(err);
        setRunError(msg || 'Run failed');
      } finally {
        setIsRunning(false);
      }
    },
    [applyImportToExistingPipeline, setPipelineFromImport, nodes.length, draftCells.length]
  );

  const handleRunAll = useCallback(() => {
    if (cells.length === 0) return;
    const scriptForImport = buildScriptFromCellCodes(cells);
    const scriptForRun = buildScriptForBrowserRun(cells, undefined, dataSourceColumnNames);
    runScriptAndImport(scriptForImport, scriptForRun, {
      clearDraftsOnSuccess: draftCells.length > 0,
    });
  }, [cells, dataSourceColumnNames, runScriptAndImport, draftCells.length]);

  const handleRunCell = useCallback(
    (cellIndex: number) => {
      const scriptForImport = buildScriptFromCellCodes(cells, cellIndex);
      const scriptForRun = buildScriptForBrowserRun(cells, cellIndex, dataSourceColumnNames);
      const runIncludesDrafts = cellIndex >= nodeCells.length;
      runScriptAndImport(scriptForImport, scriptForRun, {
        upToIndex: runIncludesDrafts ? undefined : cellIndex,
        clearDraftsOnSuccess: runIncludesDrafts,
      });
    },
    [cells, nodeCells.length, dataSourceColumnNames, runScriptAndImport]
  );

  const handleCellChange = useCallback(
    (nodeId: string, value: string) => {
      if (nodeId.startsWith('draft-')) {
        setDraftCells((prev) =>
          prev.map((d) => (d.id === nodeId ? { ...d, code: value } : d))
        );
      } else {
        updateNode(nodeId, { customCode: value || undefined });
      }
    },
    [updateNode]
  );

  const handleCopy = useCallback(async () => {
    if (!fullScript) return;
    try {
      await navigator.clipboard.writeText(fullScript);
      setCopyFeedback('script');
      setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      // ignore
    }
  }, [fullScript]);

  const handleDownloadPy = useCallback(() => {
    if (draftCells.length > 0) {
      const script = buildScriptFromCellCodes(cells);
      const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `convoy-pipeline-${Date.now()}.py`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      downloadPipelineScript(nodes, edges);
    }
  }, [cells, draftCells.length, nodes, edges]);

  const handleDownloadNotebook = useCallback(() => {
    downloadNotebook(nodes, edges);
  }, [nodes, edges]);

  const handleCopyJupyterCells = useCallback(async () => {
    const text =
      draftCells.length > 0
        ? cells
            .map(
              (c, i) =>
                `${i === 0 ? '# %%\nimport pandas as pd\n\n' : ''}# %% ${c.label}\n${c.code}\n`
            )
            .join('\n')
        : copyAsJupyterCells(nodes, edges);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('jupyter');
      setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      // ignore
    }
  }, [cells, draftCells.length, nodes, edges]);

  const selectedNodeIds = useMemo(
    () => new Set(nodes.filter((n) => n.selected).map((n) => n.id)),
    [nodes]
  );

  const handleCellClick = useCallback(
    (e: React.MouseEvent, cell: { nodeId: string }, index: number) => {
      const isDraft = cell.nodeId.startsWith('draft-');
      if (isDraft) {
        activateCell(cell.nodeId);
        return;
      }
      const shift = e.shiftKey;
      const meta = e.metaKey || e.ctrlKey;
      if (shift) {
        const anchor = selectionAnchorIndex ?? index;
        const lo = Math.min(anchor, index);
        const hi = Math.max(anchor, index);
        const nodeIdsInRange = cells
          .slice(lo, hi + 1)
          .filter((c) => !c.nodeId.startsWith('draft-'))
          .map((c) => c.nodeId);
        setSelectedNodeIds(nodeIdsInRange);
        setSelectionAnchorIndex(anchor);
        activateCell(cell.nodeId);
      } else if (meta) {
        const next = new Set(selectedNodeIds);
        if (next.has(cell.nodeId)) next.delete(cell.nodeId);
        else next.add(cell.nodeId);
        setSelectedNodeIds(Array.from(next));
        setSelectionAnchorIndex(index);
        activateCell(cell.nodeId);
      } else {
        setSelectedNodeIds([cell.nodeId]);
        setSelectionAnchorIndex(index);
        activateCell(cell.nodeId);
      }
    },
    [
      activateCell,
      cells,
      selectionAnchorIndex,
      selectedNodeIds,
      setSelectedNodeIds,
    ]
  );

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-2 py-1.5">
        <span className="text-[11px] font-semibold text-gray-700">Pipeline code</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleRunAll}
            disabled={cells.length === 0 || isRunning}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
            title="Run all cells and propose nodes"
          >
            {isRunning ? (
              <Square size={11} className="animate-pulse" />
            ) : (
              <Play size={11} />
            )}
            Run all
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!fullScript}
            className="flex items-center gap-0.5 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title={copyFeedback === 'script' ? 'Copied' : 'Copy Python script'}
          >
            <Copy size={13} />
            {copyFeedback === 'script' && (
              <span className="text-[9px] font-medium text-emerald-600">Copied</span>
            )}
          </button>
          <button
            type="button"
            onClick={handleCopyJupyterCells}
            disabled={cells.length === 0}
            className="flex items-center gap-0.5 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title={copyFeedback === 'jupyter' ? 'Copied' : 'Copy as Jupyter cells'}
          >
            <FileCode size={13} />
            {copyFeedback === 'jupyter' && (
              <span className="text-[9px] font-medium text-emerald-600">Copied</span>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadPy}
            disabled={cells.length === 0}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Download as .py"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={handleDownloadNotebook}
            disabled={nodes.length === 0}
            className="rounded px-1 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Download as .ipynb"
          >
            .ipynb
          </button>
          <button
            type="button"
            onClick={handleAddCell}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Add new cell (run to create suggested node)"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {runError && (
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-red-100 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
          <span className="min-w-0 flex-1 break-words">{runError}</span>
          <button
            type="button"
            onClick={() => setRunError(null)}
            className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-800"
            title="Dismiss"
            aria-label="Dismiss error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-1.5">
        {cells.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            Add nodes to see pipeline code, or use + to add a new cell.
          </p>
        ) : (
          <div className="space-y-2">
            {cells.map((cell, index) => {
              const isNodeBacked = !cell.nodeId.startsWith('draft-');
              const isSelected = isNodeBacked && selectedNodeIds.has(cell.nodeId);
              const isFocused = focusedCellNodeId === cell.nodeId;
              return (
              <div
                key={cell.nodeId}
                role="button"
                tabIndex={-1}
                onClick={(e) => handleCellClick(e, cell, index)}
                className={`rounded-lg border ring-2 ring-transparent transition-[border-color,box-shadow,background-color] duration-150 ${
                  isFocused && isSelected
                    ? 'border-blue-200 bg-blue-100/80 ring-blue-200'
                    : isFocused
                      ? 'border-blue-200 bg-blue-50/80 ring-blue-200'
                      : isSelected
                        ? 'border-blue-100 bg-blue-50/60 ring-blue-100'
                        : 'border-gray-100 bg-gray-50/80'
                }`}
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1">
                  <span className="text-[10px] font-medium text-gray-500">
                    {cell.label} ({cell.nodeType})
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunCell(index);
                    }}
                    disabled={isRunning}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                    title="Run up to this cell and propose nodes"
                  >
                    <Play size={10} />
                    Run
                  </button>
                </div>
                <div className="overflow-hidden rounded-b-md border-0 border-gray-200">
                  <Editor
                    height={Math.min(
                      Math.max(MIN_EDITOR_HEIGHT, cell.code.split('\n').length * 16),
                      MAX_EDITOR_HEIGHT
                    )}
                    language="python"
                    value={cell.code}
                    onChange={(value) => handleCellChange(cell.nodeId, value ?? '')}
                    theme="vs-light"
                    options={EDITOR_OPTIONS}
                    onMount={(editor) => {
                      const disposableFocus = editor.onDidFocusEditorWidget(() =>
                        activateCell(cell.nodeId)
                      );
                      const disposableBlur = editor.onDidBlurEditorWidget(() =>
                        setFocusedCellNodeId(null)
                      );
                      return () => {
                        disposableFocus.dispose();
                        disposableBlur.dispose();
                      };
                    }}
                  />
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
