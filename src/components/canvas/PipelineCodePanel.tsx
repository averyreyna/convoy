import { useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateNodeCode } from '@/lib/codeGenerators';
import {
  topologicalSort,
  exportAsPython,
  downloadPipelineScript,
  downloadNotebook,
  copyAsJupyterCells,
} from '@/lib/exportPipeline';
import { Copy, Download, FileCode } from 'lucide-react';

export function PipelineCodePanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const cells = useMemo(() => {
    const sorted = topologicalSort(nodes, edges);
    return sorted.map((node) => {
      const data = node.data as Record<string, unknown>;
      const nodeType = (node.type as string) || 'unknown';
      const label = (data.label as string) || nodeType;
      const config = { ...data };
      delete config.state;
      delete config.label;
      delete config.isCodeMode;
      delete config.customCode;
      delete config.error;
      delete config.inputRowCount;
      delete config.outputRowCount;
      const code =
        typeof data.customCode === 'string' && data.customCode.trim() !== ''
          ? data.customCode
          : generateNodeCode(nodeType, config);
      return { nodeId: node.id, nodeType, label, code };
    });
  }, [nodes, edges]);

  const fullScript = useMemo(
    () => (nodes.length > 0 ? exportAsPython(nodes, edges) : ''),
    [nodes, edges]
  );

  const handleCopy = async () => {
    if (!fullScript) return;
    try {
      await navigator.clipboard.writeText(fullScript);
    } catch {
      // ignore
    }
  };

  const handleDownloadPy = () => {
    downloadPipelineScript(nodes, edges);
  };

  const handleDownloadNotebook = () => {
    downloadNotebook(nodes, edges);
  };

  const handleCopyJupyterCells = async () => {
    const text = copyAsJupyterCells(nodes, edges);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">Pipeline code</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!fullScript}
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Copy Python script"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={handleCopyJupyterCells}
            disabled={nodes.length === 0}
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Copy as Jupyter cells"
          >
            <FileCode size={14} />
          </button>
          <button
            type="button"
            onClick={handleDownloadPy}
            disabled={nodes.length === 0}
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Download as .py"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            onClick={handleDownloadNotebook}
            disabled={nodes.length === 0}
            className="rounded px-1.5 py-1.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Download as .ipynb"
          >
            .ipynb
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {cells.length === 0 ? (
          <p className="text-xs text-gray-400">Add nodes to see pipeline code.</p>
        ) : (
          <div className="space-y-3">
            {cells.map((cell) => (
              <div
                key={cell.nodeId}
                className="rounded-lg border border-gray-100 bg-gray-50/80"
              >
                <div className="border-b border-gray-100 px-2 py-1.5 text-[10px] font-medium text-gray-500">
                  {cell.label} ({cell.nodeType})
                </div>
                <pre className="overflow-x-auto p-2 font-mono text-[11px] leading-snug text-gray-800 whitespace-pre-wrap">
                  {cell.code}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
