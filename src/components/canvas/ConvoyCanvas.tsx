import { useCallback, useRef, useState, type DragEvent } from 'react';
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
import { nodeTypeInfos } from '@/components/nodes';
import { PipelinePrompt } from './PipelinePrompt';
import { ProposedPipelineBanner } from './ProposedPipelineBanner';

let nodeIdCounter = 0;
function getNextNodeId() {
  nodeIdCounter += 1;
  return `node-${nodeIdCounter}`;
}

export function ConvoyCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const [showPrompt, setShowPrompt] = useState(false);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance.current) return;

      const nodeInfo = nodeTypeInfos.find((n) => n.type === type);
      if (!nodeInfo) return;

      // Get the position where the node was dropped
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getNextNodeId(),
        type,
        position,
        data: {
          ...nodeInfo.defaultData,
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

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
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'dataFlow',
          animated: true,
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50"
        snapToGrid
        snapGrid={[16, 16]}
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
        deleteKeyCode={['Backspace', 'Delete']}
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

      {/* AI Pipeline Prompt modal */}
      {showPrompt && (
        <PipelinePrompt onClose={() => setShowPrompt(false)} />
      )}

      {/* Empty state overlay — shown when no nodes exist */}
      {nodes.length === 0 && !showPrompt && (
        <EmptyCanvasOverlay onOpenPrompt={() => setShowPrompt(true)} />
      )}
    </div>
  );
}

// ─── Empty Canvas Overlay ───────────────────────────────────────────────────

function EmptyCanvasOverlay({ onOpenPrompt }: { onOpenPrompt: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
          <svg
            className="h-7 w-7 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
            />
          </svg>
        </div>
        <h3 className="mb-1 text-base font-semibold text-gray-700">
          Start building your pipeline
        </h3>
        <p className="mb-4 max-w-xs text-sm text-gray-500">
          Drag nodes from the sidebar, or let AI build a pipeline for you.
        </p>
        <button
          onClick={onOpenPrompt}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow-md active:bg-blue-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          Generate with AI
        </button>
      </div>
    </div>
  );
}
