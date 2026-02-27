import { useMemo, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { diffLines, type Change } from 'diff';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { generateNodeCode } from '@/lib/codeGenerators';
import {
  topologicalSortPipeline,
  exportAsPython,
  buildScriptFromCellCodes,
  buildScriptForBrowserRun,
  downloadPipelineScript,
  downloadNotebook,
  copyAsJupyterCells,
} from '@/lib/exportPipeline';
import { runFullPipelineScript } from '@/lib/pythonRunner';
import { importPipelineFromPython, editNodes } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Copy, Download, FileCode, Play, Plus, Square, X, Wand2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  label,
  button,
  alert,
  panelSection,
  caption,
  captionMuted,
  notebookScrollArea,
  notebookCellList,
  notebookCell,
  notebookCellFocused,
  notebookCellSelected,
  notebookCellGutter,
  notebookCellPrompt,
  notebookCellContent,
  notebookCellHeader,
} from '@/design-system';

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
  const replaceNodesWithSuggestedPipeline = useCanvasStore((s) => s.replaceNodesWithSuggestedPipeline);
  const setFocusNodeIdForView = useCanvasStore((s) => s.setFocusNodeIdForView);
  const setSelectedNodeIds = useCanvasStore((s) => s.setSelectedNodeIds);
  const setBaselineFromPin = useCanvasStore((s) => s.setBaselineFromPin);
  const setBaselineForNodeIds = useCanvasStore((s) => s.setBaselineForNodeIds);
  const baselineCode = useCanvasStore((s) => s.baselineCode);
  const baselineByNodeId = useCanvasStore((s) => s.baselineByNodeId);
  const nodeData = useDataStore((s) => s.nodeData);

  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [focusedCellNodeId, setFocusedCellNodeId] = useState<string | null>(null);
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);
  const [draftCells, setDraftCells] = useState<Array<{ id: string; code: string }>>([]);
  const [copyFeedback, setCopyFeedback] = useState<'script' | 'jupyter' | null>(null);
  const [editWithAIOpen, setEditWithAIOpen] = useState(false);
  const [editWithAIPrompt, setEditWithAIPrompt] = useState('');
  const [editWithAILoading, setEditWithAILoading] = useState(false);
  const [editWithAIError, setEditWithAIError] = useState<string | null>(null);
  const [fullDiffExpanded, setFullDiffExpanded] = useState(false);
  const [expandedDiffCellIds, setExpandedDiffCellIds] = useState<Set<string>>(new Set());

  const toggleCellDiff = useCallback((nodeId: string) => {
    setExpandedDiffCellIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

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
    const sorted = topologicalSortPipeline(nodes, edges);
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
    const sorted = topologicalSortPipeline(nodes, edges);
    const dataSourceNode = sorted.find((n) => (n.type as string) === 'dataSource');
    const data = dataSourceNode?.data as { columns?: Array<{ name: string }> } | undefined;
    return data?.columns?.map((c) => c.name) ?? [];
  }, [nodes, edges]);

  const runScriptAndImport = useCallback(
    async (
      scriptForImport: string,
      scriptForRun: string,
      options?: {
        upToIndex?: number;
        clearDraftsOnSuccess?: boolean;
        nodeIdsForBaseline?: string[];
      }
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
        if (options?.nodeIdsForBaseline && options.nodeIdsForBaseline.length > 0) {
          setBaselineFromPin(scriptForImport, 'python');
          setBaselineForNodeIds(options.nodeIdsForBaseline);
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
    [
      applyImportToExistingPipeline,
      setPipelineFromImport,
      setBaselineFromPin,
      setBaselineForNodeIds,
      nodes.length,
      draftCells.length,
    ]
  );

  const handleRunAll = useCallback(() => {
    if (cells.length === 0) return;
    const scriptForImport = buildScriptFromCellCodes(cells);
    const scriptForRun = buildScriptForBrowserRun(cells, undefined, dataSourceColumnNames);
    runScriptAndImport(scriptForImport, scriptForRun, {
      clearDraftsOnSuccess: draftCells.length > 0,
      nodeIdsForBaseline: nodeCells.map((c) => c.nodeId),
    });
  }, [cells, dataSourceColumnNames, runScriptAndImport, draftCells.length, nodeCells]);

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

  const selectedNodeIdsArray = useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds]);

  const dataSchemaForEdit = useMemo(() => {
    const dataSourceNode = nodes.find(
      (n) => n.type === 'dataSource' && (n.data as { state?: string })?.state === 'confirmed'
    );
    if (!dataSourceNode) return null;
    const data = nodeData[dataSourceNode.id];
    if (!data?.columns) return null;
    return { columns: data.columns };
  }, [nodes, nodeData]);

  const handleEditSelectionWithAISubmit = useCallback(async () => {
    if (!editWithAIPrompt.trim() || selectedNodeIdsArray.length === 0) return;
    setEditWithAILoading(true);
    setEditWithAIError(null);
    try {
      const pipelineContext = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data as Record<string, unknown>,
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      };
      const res = await editNodes({
        nodeIds: selectedNodeIdsArray,
        prompt: editWithAIPrompt.trim(),
        schema: dataSchemaForEdit ?? undefined,
        pipelineContext,
      });
      const pipeline = res.suggestedPipeline;
      if (!pipeline?.nodes?.length) {
        setEditWithAIError('AI returned no changes. Try a more specific prompt.');
        return;
      }
      const nodeIdsToReplace = selectedNodeIdsArray.filter(
        (nid) => nodes.find((n) => n.id === nid)?.type !== 'dataSource'
      );
      const dataSourceInSelection = selectedNodeIdsArray.find(
        (nid) => nodes.find((n) => n.id === nid)?.type === 'dataSource'
      );
      if (nodeIdsToReplace.length === 0 && dataSourceInSelection) {
        replaceNodesWithSuggestedPipeline([], pipeline, {
          insertAfterNodeId: dataSourceInSelection,
        });
      } else if (nodeIdsToReplace.length > 0) {
        replaceNodesWithSuggestedPipeline(nodeIdsToReplace, pipeline);
      } else {
        replaceNodesWithSuggestedPipeline(selectedNodeIdsArray, pipeline);
      }
      setEditWithAIPrompt('');
      setEditWithAIOpen(false);
    } catch (err) {
      console.error('Edit with AI failed:', err);
      setEditWithAIError(err instanceof Error ? err.message : 'Edit failed. Please try again.');
    } finally {
      setEditWithAILoading(false);
    }
  }, [
    editWithAIPrompt,
    selectedNodeIdsArray,
    nodes,
    edges,
    dataSchemaForEdit,
    replaceNodesWithSuggestedPipeline,
  ]);

  const currentExportForDiff = useMemo(() => {
    if (nodes.length === 0) return '';
    return exportAsPython(nodes, edges);
  }, [nodes, edges]);

  const fullDiffRows = useMemo(() => {
    if (!baselineCode || baselineCode.length === 0) return null;
    const changes = diffLines(baselineCode, currentExportForDiff) as Change[];
    const rows: { kind: 'unchanged' | 'removed' | 'added'; leftNum?: number; rightNum?: number; text: string }[] = [];
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
          rows.push({ kind: 'unchanged', leftNum: leftNum++, rightNum: rightNum++, text: line });
        }
      }
    }
    return rows;
  }, [baselineCode, currentExportForDiff]);

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
      <div className={cn(panelSection, 'flex shrink-0 items-center justify-between')}>
        <span className={label}>Pipeline code</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setEditWithAIOpen((v) => !v)}
            disabled={selectedNodeIdsArray.length === 0}
            className={cn(
              button.base,
              button.variants.secondary,
              button.sizes.sm,
              'disabled:opacity-50'
            )}
            title="Edit selected cells with AI"
          >
            <Wand2 size={13} />
            Edit selection with AI
          </button>
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
            className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
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
            className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
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
            className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
            title="Download as .py"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={handleDownloadNotebook}
            disabled={nodes.length === 0}
            className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
            title="Download as .ipynb"
          >
            .ipynb
          </button>
          <button
            type="button"
            onClick={handleAddCell}
            className={cn(button.base, button.variants.ghost, button.sizes.sm)}
            title="Add new cell (run to create suggested node)"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {editWithAIOpen && (
        <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-2">
          <textarea
            value={editWithAIPrompt}
            onChange={(e) => {
              setEditWithAIPrompt(e.target.value);
              setEditWithAIError(null);
            }}
            placeholder="Describe how to change the selected cells..."
            className={cn('mb-2 min-h-[60px] w-full resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-xs')}
            disabled={editWithAILoading}
          />
          {editWithAIError && (
            <div className={cn(alert, 'mb-2 flex items-start gap-2 text-xs')}>
              <span className="flex-shrink-0 text-red-500">!</span>
              <span>{editWithAIError}</span>
            </div>
          )}
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setEditWithAIOpen(false);
                setEditWithAIError(null);
              }}
              disabled={editWithAILoading}
              className={cn(button.base, button.variants.secondary, button.sizes.sm)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSelectionWithAISubmit}
              disabled={!editWithAIPrompt.trim() || editWithAILoading}
              className={cn(button.base, button.variants.primary, button.sizes.sm, 'disabled:opacity-50')}
            >
              {editWithAILoading ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      {runError && (
        <div className={cn(alert, 'flex shrink-0 items-start justify-between gap-2 border-b')}>
          <span className="min-w-0 flex-1 break-words">{runError}</span>
          <button
            type="button"
            onClick={() => setRunError(null)}
            className={cn(button.base, button.variants.ghost, 'shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-800')}
            title="Dismiss"
            aria-label="Dismiss error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className={cn(notebookScrollArea)}>
        {cells.length === 0 ? (
          <p className={captionMuted}>
            Add nodes to see pipeline code, or use + to add a new cell.
          </p>
        ) : (
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
                return JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]]));
              };
              const configChanged =
                !!baseline &&
                !!node &&
                configSnapshot(baseline.config) !== configSnapshot(node.data as Record<string, unknown>);
              const codeChanged =
                !!baseline &&
                (baseline.customCode ?? '') !== ((node?.data as { customCode?: string })?.customCode ?? '');
              const hasCellDiff = !!baseline && (configChanged || codeChanged);
              const cellDiffExpanded = expandedDiffCellIds.has(cell.nodeId);
              const cellCodeDiffLines =
                hasCellDiff && codeChanged && baseline
                  ? (diffLines(baseline.customCode ?? '', (node?.data as { customCode?: string })?.customCode ?? '') as Change[])
                  : null;
              return (
              <div
                key={cell.nodeId}
                role="button"
                tabIndex={-1}
                onClick={(e) => handleCellClick(e, cell, index)}
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
                      handleRunCell(index);
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
                {hasCellDiff && (
                  <div className="border-t border-gray-100 bg-gray-50/80">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCellDiff(cell.nodeId);
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
                              {JSON.stringify(node?.data && typeof node.data === 'object' ? node.data : {})}
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
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {baselineCode != null && baselineCode.length > 0 && (
        <div className="shrink-0 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setFullDiffExpanded((x) => !x)}
            className={cn(
              'flex w-full items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1.5 text-left',
              button.base,
              button.variants.ghost,
              button.sizes.sm
            )}
          >
            {fullDiffExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className={caption}>Diff since last run</span>
          </button>
          {fullDiffExpanded && fullDiffRows && (
            <div className="grid max-h-48 grid-cols-2 gap-px overflow-auto bg-gray-200 font-mono text-[10px]">
              <div className="flex flex-col bg-gray-50">
                <div className={cn(caption, 'sticky top-0 border-b border-gray-200 bg-white px-2 py-1')}>
                  Before (last run)
                </div>
                <div className="overflow-auto p-1.5">
                  {fullDiffRows.map((row, i) =>
                    row.kind === 'removed' ? (
                      <div
                        key={`l-${i}`}
                        className="border-l-2 border-red-400 bg-red-50 py-0.5 pl-1.5 pr-1 text-red-900"
                      >
                        {row.text || ' '}
                      </div>
                    ) : row.kind === 'unchanged' ? (
                      <div key={`l-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-700">
                        {row.text || ' '}
                      </div>
                    ) : (
                      <div key={`l-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-300"> </div>
                    )
                  )}
                </div>
              </div>
              <div className="flex flex-col bg-gray-50">
                <div className={cn(caption, 'sticky top-0 border-b border-gray-200 bg-white px-2 py-1')}>
                  After (current)
                </div>
                <div className="overflow-auto p-1.5">
                  {fullDiffRows.map((row, i) =>
                    row.kind === 'added' ? (
                      <div
                        key={`r-${i}`}
                        className="border-l-2 border-emerald-500 bg-emerald-50 py-0.5 pl-1.5 pr-1 text-emerald-900"
                      >
                        {row.text || ' '}
                      </div>
                    ) : row.kind === 'unchanged' ? (
                      <div key={`r-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-700">
                        {row.text || ' '}
                      </div>
                    ) : (
                      <div key={`r-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-300"> </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
