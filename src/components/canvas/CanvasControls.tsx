import { useState, useRef, useEffect, useCallback } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, ExternalLink, GitCompare } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { downloadPipelineScript } from '@/lib/exportPipeline';
import { checkDatawrapperStatus } from '@/lib/datawrapper';
import { DatawrapperExportModal } from './DatawrapperExportModal';
import { ScriptDiffModal } from './ScriptDiffModal';

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);
  const setShowImportD3Modal = useCanvasStore((s) => s.setShowImportD3Modal);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [dwConfigured, setDwConfigured] = useState<boolean | null>(null);
  const [showDwModal, setShowDwModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  };

  const hasNodes = nodes.length > 0;

  // Check Datawrapper token status on mount
  useEffect(() => {
    checkDatawrapperStatus().then(setDwConfigured);
  }, []);

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

  /**
   * Find the best data to export: the last transformation node's output
   * (upstream of the Chart node, or the last node if no chart exists).
   * Also returns the Chart node's config if one exists.
   */
  const getPipelineExportData = useCallback(() => {
    const parentMap = new Map<string, string>();
    for (const edge of edges) {
      parentMap.set(edge.target, edge.source);
    }

    // Find chart node (if any) and its upstream data node
    const chartNode = nodes.find((n) => n.type === 'chart');
    let dataNodeId: string | undefined;

    if (chartNode) {
      // The chart's upstream node has the data we want
      dataNodeId = parentMap.get(chartNode.id);
    }

    if (!dataNodeId) {
      // No chart or no upstream: find the last non-chart confirmed node
      // Walk from nodes that have no outgoing edges (leaf nodes)
      const hasOutgoing = new Set(edges.map((e) => e.source));
      const leafNodes = nodes.filter(
        (n) => n.type !== 'chart' && !hasOutgoing.has(n.id)
      );
      dataNodeId = leafNodes[leafNodes.length - 1]?.id;
    }

    if (!dataNodeId) {
      // Fallback: just use the first node with output data
      const outputKeys = Object.keys(useDataStore.getState().nodeOutputs);
      dataNodeId = outputKeys[outputKeys.length - 1];
    }

    const dataFrame = dataNodeId
      ? useDataStore.getState().getNodeOutput(dataNodeId)
      : undefined;

    const chartConfig = chartNode
      ? (chartNode.data as Record<string, unknown>)
      : undefined;

    return { dataFrame, chartConfig };
  }, [nodes, edges]);

  const handleDatawrapperExport = useCallback(() => {
    setShowExportMenu(false);
    setShowDwModal(true);
  }, []);

  const { dataFrame, chartConfig } = showDwModal
    ? getPipelineExportData()
    : { dataFrame: undefined, chartConfig: undefined };

  return (
    <>
      <Panel position="bottom-right" className="flex gap-1">
        {/* Export button — always visible so "Code changes" and import are findable */}
        <div ref={menuRef} className="relative">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Export and code changes"
              title="Export, import, and view code diff"
            >
              <Download size={14} />
              Export
            </button>
          </div>

          {/* Export dropdown menu */}
          {showExportMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  setShowImportModal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-[9px] font-bold text-emerald-700">
                  PY
                </span>
                Import from Python
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  setShowImportD3Modal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-[9px] font-bold text-amber-700">
                  D3
                </span>
                Import from D3
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  setShowDiffModal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                title="View diff between baseline and current export (Phase 1)"
              >
                <GitCompare size={14} className="text-gray-500" />
                Code changes
              </button>
              <button
                onClick={() => {
                  downloadPipelineScript(nodes, edges, 'javascript');
                  setShowExportMenu(false);
                }}
                disabled={!hasNodes}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                  hasNodes ? 'text-gray-700 hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'
                }`}
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
                disabled={!hasNodes}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                  hasNodes ? 'text-gray-700 hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[9px] font-bold text-blue-700">
                  PY
                </span>
                Export as Python
              </button>

              {/* Divider */}
              <div className="my-1 h-px bg-gray-100" />

              {/* Datawrapper export */}
              <button
                onClick={handleDatawrapperExport}
                disabled={dwConfigured === false || !hasNodes}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                  dwConfigured === false || !hasNodes
                    ? 'cursor-not-allowed text-gray-400'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={
                  !hasNodes
                    ? 'Add nodes to export'
                    : dwConfigured === false
                      ? 'Add DATAWRAPPER_API_TOKEN to .env to enable'
                      : 'Send pipeline data to Datawrapper'
                }
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-[9px] font-bold text-emerald-700">
                  DW
                </span>
                Send to Datawrapper
                <ExternalLink size={10} className="ml-auto opacity-50" />
              </button>
            </div>
          )}
        </div>

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

      {/* Datawrapper Export Modal */}
      <DatawrapperExportModal
        isOpen={showDwModal}
        onClose={() => setShowDwModal(false)}
        dataFrame={dataFrame}
        chartConfig={chartConfig}
      />

      {/* Script diff / Code changes modal */}
      <ScriptDiffModal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
      />
    </>
  );
}
