import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ConvoyCanvas } from '@/components/canvas/ConvoyCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';
import { SidebarHeader } from '@/components/canvas/SidebarHeader';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            left: sidebarOpen ? (20 + 240 + 16) : 20,
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

        <div className="flex-1 min-w-0">
          <ConvoyCanvas />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
