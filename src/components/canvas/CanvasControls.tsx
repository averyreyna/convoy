import { useState, useRef, useEffect, useCallback } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, GitCompare, Wand2, X, AlertCircle, Pin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { downloadPipelineScript } from '@/lib/exportPipeline';
import { editNodes } from '@/lib/api';
import {
  button,
  modalOverlay,
  modalPanel,
  headingSm,
  caption,
  input,
  alert,
  dividerVertical,
  spinner,
  iconWell,
  menuPanel,
  menuItem,
  menuItemIcon,
} from '@/design-system';
import { ScriptDiffModal } from './ScriptDiffModal';

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);
  const setBaselineForSelection = useCanvasStore((s) => s.setBaselineForSelection);
  const clearAllNodeBaselines = useCanvasStore((s) => s.clearAllNodeBaselines);
  const baselineByNodeId = useCanvasStore((s) => s.baselineByNodeId);
  const hasNodeBaselines = Object.keys(baselineByNodeId).length > 0;
  const focusNodeIdForView = useCanvasStore((s) => s.focusNodeIdForView);
  const setFocusNodeIdForView = useCanvasStore((s) => s.setFocusNodeIdForView);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showEditWithAIModal, setShowEditWithAIModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedCount = selectedNodes.length;

  const handleReset = () => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  };

  const hasNodes = nodes.length > 0;

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

  useEffect(() => {
    if (!showEditWithAIModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowEditWithAIModal(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showEditWithAIModal]);

  // when a code cell is focused, snap canvas viewport to that node
  useEffect(() => {
    if (!focusNodeIdForView) return;
    fitView({
      nodes: [{ id: focusNodeIdForView }],
      duration: 300,
      padding: 0.2,
    });
    setFocusNodeIdForView(null);
  }, [focusNodeIdForView, fitView, setFocusNodeIdForView]);

  const nodeData = useDataStore((s) => s.nodeData);
  const dataSchemaForEdit = (() => {
    const dataSourceNode = nodes.find(
      (n) => n.type === 'dataSource' && (n.data as { state?: string })?.state === 'confirmed'
    );
    if (!dataSourceNode) return null;
    const data = nodeData[dataSourceNode.id];
    if (!data?.columns) return null;
    return { columns: data.columns };
  })();

  const handleEditWithAISubmit = useCallback(async () => {
    if (!editPrompt.trim() || selectedCount === 0) return;
    const nodeIds = selectedNodes.map((n) => n.id);
    setEditLoading(true);
    setEditError(null);
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
      const { updates } = await editNodes({
        nodeIds,
        prompt: editPrompt.trim(),
        schema: dataSchemaForEdit ?? undefined,
        pipelineContext,
      });
      for (const [nodeId, update] of Object.entries(updates)) {
        if (!update) continue;
        const data: Record<string, unknown> = {};
        if (update.config) Object.assign(data, update.config);
        if (update.customCode !== undefined) data.customCode = update.customCode;
        if (Object.keys(data).length > 0) updateNode(nodeId, data);
      }
      setEditPrompt('');
      setShowEditWithAIModal(false);
    } catch (err) {
      console.error('Edit with AI failed:', err);
      setEditError(err instanceof Error ? err.message : 'Edit failed. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }, [editPrompt, selectedCount, selectedNodes, nodes, edges, dataSchemaForEdit, updateNode]);

  return (
    <>
      {selectedCount > 0 && (
        <Panel position="top-center" className="mt-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-600">
              {selectedCount} node{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => {
                setEditPrompt('');
                setEditError(null);
                setShowEditWithAIModal(true);
              }}
              className={cn(button.base, button.variants.primary, button.sizes.md)}
              title="Edit selected nodes with AI"
            >
              <Wand2 size={14} />
              Edit with AI
            </button>
            <button
              onClick={() => setBaselineForSelection()}
              className={cn(button.base, button.variants.secondary, button.sizes.md)}
              title="Pin selection as baseline for inline diff"
            >
              <Pin size={14} />
              Pin selection
            </button>
          </div>
        </Panel>
      )}

      <Panel position="bottom-right" className="flex gap-1">
        <div ref={menuRef} className="relative">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className={cn(button.base, button.variants.ghost, button.sizes.sm)}
              aria-label="Export and code changes"
              title="Export, import, and view code diff"
            >
              <Download size={14} />
              Export
            </button>
          </div>

          {showExportMenu && (
            <div className={cn(menuPanel, 'absolute bottom-full right-0 mb-1 w-52')}>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  setShowImportModal(true);
                }}
                className={menuItem}
              >
                <span className={cn(menuItemIcon, 'flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-[9px] font-bold text-emerald-700')}>
                  PY
                </span>
                Import from Python
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  setShowDiffModal(true);
                }}
                className={menuItem}
                title="View diff between baseline and current export"
              >
                <GitCompare size={14} className={menuItemIcon} />
                Code changes
              </button>
              {hasNodeBaselines && (
                <button
                  onClick={() => {
                    clearAllNodeBaselines();
                    setShowExportMenu(false);
                  }}
                  className={menuItem}
                  title="Clear per-node diff baselines"
                >
                  <Trash2 size={14} className={menuItemIcon} />
                  Clear node baselines
                </button>
              )}
              <button
                onClick={() => {
                  downloadPipelineScript(nodes, edges);
                  setShowExportMenu(false);
                }}
                disabled={!hasNodes}
                className={cn(menuItem, !hasNodes && 'cursor-not-allowed text-gray-400')}
              >
                <span className={cn(menuItemIcon, 'flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[9px] font-bold text-blue-700')}>
                  PY
                </span>
                Export as Python
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => zoomIn({ duration: 200 })}
            className={cn(button.base, button.variants.ghost, button.sizes.sm)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => zoomOut({ duration: 200 })}
            className={cn(button.base, button.variants.ghost, button.sizes.sm)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <div className={cn(dividerVertical, 'mx-0.5 shrink-0')} />
          <button
            type="button"
            onClick={() => fitView({ duration: 300, padding: 0.2 })}
            className={cn(button.base, button.variants.ghost, button.sizes.sm)}
            aria-label="Fit view"
            title="Fit to view"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className={cn(button.base, button.variants.ghost, button.sizes.sm)}
            aria-label="Reset view"
            title="Reset view"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </Panel>

      <ScriptDiffModal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
      />

      {showEditWithAIModal && (
        <div
          className={modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditWithAIModal(false);
          }}
        >
          <div
            className={cn(modalPanel, 'w-full max-w-md p-4')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(iconWell, 'h-8 w-8')}>
                  <Wand2 className="text-blue-500" size={18} />
                </div>
                <div>
                  <h2 className={headingSm}>Edit with AI</h2>
                  <p className={caption}>
                    Describe how to change the {selectedCount} selected node{selectedCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditWithAIModal(false)}
                className={cn(button.base, button.variants.ghost, button.sizes.sm)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={editPrompt}
              onChange={(e) => {
                setEditPrompt(e.target.value);
                setEditError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowEditWithAIModal(false);
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleEditWithAISubmit();
                }
              }}
              placeholder="e.g., Change the filter to use column X and value Y..."
              className={cn(input.default, 'mb-3 h-20 resize-none text-sm')}
              disabled={editLoading}
              autoFocus
            />
            {editError && (
              <div className={cn(alert, 'mb-3 flex items-start gap-2')}>
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p className="text-xs">{editError}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEditWithAIModal(false)}
                disabled={editLoading}
                className={cn(button.base, button.variants.secondary, button.sizes.md, 'disabled:opacity-50')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditWithAISubmit}
                disabled={!editPrompt.trim() || editLoading}
                className={cn(button.base, button.variants.primary, button.sizes.md, 'disabled:cursor-not-allowed disabled:opacity-50')}
              >
                {editLoading ? (
                  <>
                    <div className={cn(spinner, 'border-white/30 border-t-white')} />
                    Applying...
                  </>
                ) : (
                  'Apply'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
