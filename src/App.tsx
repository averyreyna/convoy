import { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight, Code2, Globe, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { ConvoyCanvas, NodePalette, SidebarHeader, PipelineCodePanel } from '@/components/canvas';
import { pageBackground } from '@/flank';

const MIN_CODE_PCT = 25;
const MAX_CODE_PCT = 50;
const DEFAULT_CODE_PCT = 38;

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [codeEditorOpen, setCodeEditorOpen] = useState(true);
  const setShowPrompt = useCanvasStore((s) => s.setShowPrompt);
  const [codePanelPct, setCodePanelPct] = useState(DEFAULT_CODE_PCT);
  const isDragging = useRef(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return;
      const total = window.innerWidth;
      const rightPct = (1 - e.clientX / total) * 100;
      const clamped = Math.min(MAX_CODE_PCT, Math.max(MIN_CODE_PCT, rightPct));
      setCodePanelPct(clamped);
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const canvasPct = 100 - codePanelPct;

  return (
    <div className={cn('relative flex h-screen w-screen overflow-hidden', pageBackground)}>
      <ReactFlowProvider>
        <div className="absolute left-0 top-0 z-10">
          <SidebarHeader />
        </div>

        <div
          className="absolute left-0 top-1/2 z-20 flex min-h-[320px] max-h-[calc(100vh-4rem)] w-60 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg transition-[opacity,transform] duration-300 ease-in-out"
          style={{
            left: 20,
            opacity: sidebarOpen ? 1 : 0,
            transform: sidebarOpen
              ? 'translateY(-50%)'
              : 'translate(-12px, -50%)',
            pointerEvents: sidebarOpen ? 'auto' : 'none',
          }}
        >
          <NodePalette />
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-[left] duration-300 ease-in-out hover:border-gray-300 hover:bg-gray-50"
          style={{
            left: sidebarOpen ? 20 + 240 + 16 : 20,
          }}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarOpen ? (
            <ChevronLeft size={18} className="text-gray-600" />
          ) : (
            <ChevronRight size={18} className="text-gray-600" />
          )}
        </button>

        <div className="relative flex flex-1 min-w-0" style={{ marginLeft: 0 }}>
          {/* Canvas column: toolbar buttons are positioned relative to this so they track code view toggle */}
          <div
            className="relative min-h-0 min-w-0 shrink-0 transition-[width] duration-300 ease-in-out"
            style={{ width: codeEditorOpen ? `${canvasPct}%` : '100%' }}
          >
            <ConvoyCanvas />
            {/* Bottom toolbar: centered in canvas area; spacing updates when code panel opens/closes */}
            <button
              type="button"
              onClick={() => setShowPrompt(true)}
              className="absolute bottom-5 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-2 rounded-lg border border-gray-300 bg-gray-800 px-4 shadow-md hover:border-gray-400 hover:bg-gray-700"
              title="Describe what you want to visualize"
              aria-label="Describe what you want to visualize"
            >
              <Sparkles size={16} className="text-amber-300" />
              <span className="text-sm font-medium text-white">Describe</span>
            </button>
            <button
              type="button"
              onClick={() => setCodeEditorOpen((v) => !v)}
              className="absolute bottom-5 left-5 z-30 flex h-9 w-[72px] items-stretch overflow-hidden rounded-lg border border-gray-300 bg-gray-800 shadow-md hover:border-gray-400"
              title={codeEditorOpen ? 'Close Editor (E)' : 'Open Editor (E)'}
              aria-label={codeEditorOpen ? 'Close Editor' : 'Open Editor'}
            >
              {/* Inactive icons (gray) — full width track */}
              <span className="flex w-1/2 items-center justify-center text-gray-400" aria-hidden>
                <Code2 size={16} />
              </span>
              <span className="flex w-1/2 items-center justify-center text-gray-400" aria-hidden>
                <Globe size={16} />
              </span>
              {/* Sliding blue thumb with white icons — same duration as sidebar */}
              <span
                className="absolute inset-y-0 flex w-1/2 items-center justify-center bg-blue-500 text-white transition-[left] duration-300 ease-in-out"
                style={{ left: codeEditorOpen ? 0 : '50%' }}
                aria-hidden
              >
                {codeEditorOpen ? (
                  <Code2 size={16} />
                ) : (
                  <Globe size={16} />
                )}
              </span>
            </button>
          </div>
          {codeEditorOpen && (
            <div
              role="separator"
              aria-label="Resize code panel"
              onMouseDown={handleDividerMouseDown}
              className="w-1 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-300"
            />
          )}
          <div
            className="flex min-h-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
            style={{ width: codeEditorOpen ? `${codePanelPct}%` : 0 }}
          >
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col transition-[opacity,transform] duration-300 ease-in-out"
              style={{
                opacity: codeEditorOpen ? 1 : 0,
                transform: codeEditorOpen
                  ? 'translateX(0)'
                  : 'translateX(12px)',
                pointerEvents: codeEditorOpen ? 'auto' : 'none',
              }}
            >
              <PipelineCodePanel />
            </div>
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
