import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/stores/canvasStore';
import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { CanvasControls } from './CanvasControls';
import { PipelinePrompt } from './PipelinePrompt';
import { ImportFromPythonModal } from './ImportFromPythonModal';
import { ProposedPipelineBanner } from './ProposedPipelineBanner';

export function ConvoyCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const showPrompt = useCanvasStore((s) => s.showPrompt);
  const setShowPrompt = useCanvasStore((s) => s.setShowPrompt);
  const showImportModal = useCanvasStore((s) => s.showImportModal);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  return (
    <div ref={reactFlowWrapper} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'dataFlow',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50"
        snapToGrid
        snapGrid={[16, 16]}
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d1d5db"
        />
        <MiniMap
          nodeStrokeWidth={2}
          pannable
          zoomable
          className="!bottom-16 !right-2"
          maskColor="rgba(0, 0, 0, 0.08)"
          nodeColor={(node) => {
            if (node.data?.state === 'proposed') return '#d1d5db';
            if (node.data?.state === 'error') return '#ef4444';
            if (node.data?.state === 'running') return '#3b82f6';
            return '#6b7280';
          }}
        />
        <CanvasControls />
      </ReactFlow>

      {/* Proposed pipeline banner */}
      <ProposedPipelineBanner />

      {/* Pipeline prompt modal */}
      {showPrompt && (
        <PipelinePrompt onClose={() => setShowPrompt(false)} />
      )}

      {/* Import from Python modal */}
      {showImportModal && (
        <ImportFromPythonModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
