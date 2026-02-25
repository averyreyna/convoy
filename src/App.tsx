import { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ConvoyCanvas } from '@/components/canvas/ConvoyCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';
import { SidebarHeader } from '@/components/canvas/SidebarHeader';
import { PipelineCodePanel } from '@/components/canvas/PipelineCodePanel';

const MIN_CODE_PCT = 25;
const MAX_CODE_PCT = 50;
const DEFAULT_CODE_PCT = 38;

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="relative flex h-screen w-screen overflow-hidden bg-gray-50">
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

        <div className="flex flex-1 min-w-0" style={{ marginLeft: 0 }}>
          <div
            className="min-h-0 min-w-0 shrink-0"
            style={{ width: `${canvasPct}%` }}
          >
            <ConvoyCanvas />
          </div>
          <div
            role="separator"
            aria-label="Resize code panel"
            onMouseDown={handleDividerMouseDown}
            className="w-1 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-300"
          />
          <div
            className="min-h-0 min-w-0 shrink-0 overflow-hidden"
            style={{ width: `${codePanelPct}%` }}
          >
            <PipelineCodePanel />
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
