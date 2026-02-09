import { ReactFlowProvider } from '@xyflow/react';
import { ConvoyCanvas } from '@/components/canvas/ConvoyCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <ReactFlowProvider>
        {/* Sidebar */}
        <NodePalette />

        {/* Canvas */}
        <div className="flex-1">
          <ConvoyCanvas />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
