import { useState, useRef, useEffect } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { downloadPipelineScript } from '@/lib/exportPipeline';
import {
  button,
  dividerVertical,
  menuPanel,
  menuItem,
  menuItemIcon,
} from '@/flank';
import { ScriptDiffModal } from '../modals/ScriptDiffModal';

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);
  const focusNodeIdForView = useCanvasStore((s) => s.focusNodeIdForView);
  const setFocusNodeIdForView = useCanvasStore((s) => s.setFocusNodeIdForView);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
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
    </>
  );
}
