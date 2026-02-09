import { useState, useRef, useEffect } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { downloadPipelineScript } from '@/lib/exportPipeline';

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  };

  const hasNodes = nodes.length > 0;

  // Close menu on outside click
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

  return (
    <Panel position="bottom-right" className="flex gap-1">
      {/* Export button */}
      {hasNodes && (
        <div ref={menuRef} className="relative">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Export pipeline"
              title="Export pipeline as script"
            >
              <Download size={14} />
              Export
            </button>
          </div>

          {/* Export dropdown menu */}
          {showExportMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  downloadPipelineScript(nodes, edges, 'javascript');
                  setShowExportMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-yellow-100 text-[9px] font-bold text-yellow-700">
                  JS
                </span>
                Export as JavaScript
              </button>
              <button
                onClick={() => {
                  downloadPipelineScript(nodes, edges, 'python');
                  setShowExportMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[9px] font-bold text-blue-700">
                  PY
                </span>
                Export as Python
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zoom / view controls */}
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <div className="mx-0.5 h-4 w-px bg-gray-200" />
        <button
          onClick={() => fitView({ duration: 300, padding: 0.2 })}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Fit view"
          title="Fit to view"
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={handleReset}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Reset view"
          title="Reset view"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </Panel>
  );
}
