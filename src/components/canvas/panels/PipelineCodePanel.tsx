import { useMemo, useState, useCallback } from 'react';
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
import { buildEditNodesPipelineContext } from '@/lib/pipelineContext';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import {
  alert,
  button,
  caption,
  captionMuted,
  notebookScrollArea,
  panelSection,
} from '@/flank';
import { EditWithAIAssistant } from '../ai/EditWithAIAssistant';
import { PipelineCodeToolbar } from './PipelineCodePanel/PipelineCodeToolbar';
import {
  PipelineCellList,
  type PipelineCellViewModel,
} from './PipelineCodePanel/PipelineCellList';
import { PipelineFullDiff, type FullDiffRow } from './PipelineCodePanel/PipelineFullDiff';

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

  const nodeCells: PipelineCellViewModel[] = useMemo(() => {
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

  const cells: PipelineCellViewModel[] = useMemo(() => {
    const draftAsCells: PipelineCellViewModel[] = draftCells.map((d) => ({
      nodeId: d.id,
      nodeType: 'transform',
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
      const pipelineContext = buildEditNodesPipelineContext(nodes, edges);
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

  const fullDiffRows: FullDiffRow[] | null = useMemo(() => {
    if (!baselineCode || baselineCode.length === 0) return null;
    const changes = diffLines(baselineCode, currentExportForDiff) as Change[];
    const rows: FullDiffRow[] = [];
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
        <PipelineCodeToolbar
          canEditWithAI={selectedNodeIdsArray.length > 0}
          onToggleEditWithAI={() => setEditWithAIOpen((v) => !v)}
          canRunAll={cells.length > 0}
          isRunning={isRunning}
          onRunAll={handleRunAll}
          canCopyScript={!!fullScript}
          copyFeedback={copyFeedback}
          onCopyScript={handleCopy}
          canCopyJupyter={cells.length > 0}
          onCopyJupyter={handleCopyJupyterCells}
          canDownloadPy={cells.length > 0}
          onDownloadPy={handleDownloadPy}
          canDownloadNotebook={nodes.length > 0}
          onDownloadNotebook={handleDownloadNotebook}
          onAddCell={handleAddCell}
        />
      </div>

      {editWithAIOpen && (
        <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-2">
          <EditWithAIAssistant
            selectedCount={selectedNodeIdsArray.length}
            editPrompt={editWithAIPrompt}
            setEditPrompt={(value) => {
              setEditWithAIPrompt(value);
              setEditWithAIError(null);
            }}
            editLoading={editWithAILoading}
            editError={editWithAIError}
            onClose={() => {
              setEditWithAIOpen(false);
              setEditWithAIError(null);
            }}
            onSubmit={handleEditSelectionWithAISubmit}
          />
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
          <PipelineCellList
            cells={cells}
            nodes={nodes}
            baselineByNodeId={baselineByNodeId}
            selectedNodeIds={selectedNodeIds}
            focusedCellNodeId={focusedCellNodeId}
            isRunning={isRunning}
            expandedDiffCellIds={expandedDiffCellIds}
            onCellClick={handleCellClick}
            onRunCell={handleRunCell}
            onToggleCellDiff={toggleCellDiff}
            onActivateCell={activateCell}
            onClearFocusedCell={() => setFocusedCellNodeId(null)}
            onCellCodeChange={handleCellChange}
          />
        )}
      </div>

      <PipelineFullDiff
        hasBaseline={baselineCode != null && baselineCode.length > 0}
        fullDiffExpanded={fullDiffExpanded}
        onToggleFullDiff={() => setFullDiffExpanded((x) => !x)}
        rows={fullDiffRows}
      />
    </div>
  );
}
