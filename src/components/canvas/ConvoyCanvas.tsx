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
import { usePreferencesStore } from '@/stores/preferencesStore';
import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { CanvasControls } from './CanvasControls';
import { nodeTypeInfos } from '@/components/nodes';
import { PipelinePrompt } from './PipelinePrompt';
import { ImportFromPythonModal } from './ImportFromPythonModal';
import { ProposedPipelineBanner } from './ProposedPipelineBanner';
import { EntryScreen } from './EntryScreen';

let nodeIdCounter = 0;
function getNextNodeId() {
  nodeIdCounter += 1;
  return `node-${nodeIdCounter}`;
}

export function ConvoyCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const showPrompt = useCanvasStore((s) => s.showPrompt);
  const setShowPrompt = useCanvasStore((s) => s.setShowPrompt);
  const showImportModal = useCanvasStore((s) => s.showImportModal);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const welcomeCardDismissed = useCanvasStore((s) => s.welcomeCardDismissed);
  const dismissWelcomeCard = useCanvasStore((s) => s.dismissWelcomeCard);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);
  const showCodeByDefault = usePreferencesStore((s) => s.showCodeByDefault);

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

      const supportsCodeMode =
        type !== 'dataSource' && type !== 'transform';
      const newNode = {
        id: getNextNodeId(),
        type,
        position,
        data: {
          ...nodeInfo.defaultData,
          ...(supportsCodeMode
            ? { isCodeMode: showCodeByDefault }
            : {}),
        },
      };

      addNode(newNode);
    },
    [addNode, showCodeByDefault]
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
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50"
        snapToGrid
        snapGrid={[16, 16]}
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        selectionOnDrag
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
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

      {/* Welcome card on canvas when empty — user can dismiss if they don't need it */}
      {nodes.length === 0 && !welcomeCardDismissed && !showImportModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <EntryScreen
            onOpenImportPython={() => setShowImportModal(true)}
            onDismiss={dismissWelcomeCard}
          />
        </div>
      )}
    </div>
  );
}
