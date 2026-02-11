import { Layers, CheckCheck, Trash2, X } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';

export function ProposedPipelineBanner() {
  const nodes = useCanvasStore((s) => s.nodes);
  const confirmAllProposed = useCanvasStore((s) => s.confirmAllProposed);
  const clearProposed = useCanvasStore((s) => s.clearProposed);

  const proposedCount = nodes.filter((n) => n.data.state === 'proposed').length;

  if (proposedCount === 0) return null;

  return (
    <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-2.5 shadow-lg shadow-blue-100/50">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            {proposedCount} proposed {proposedCount === 1 ? 'node' : 'nodes'}
          </span>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={confirmAllProposed}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          >
            <CheckCheck size={14} />
            Confirm all
          </button>
          <button
            onClick={clearProposed}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600 active:bg-gray-100"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>

        <button
          onClick={clearProposed}
          className="ml-1 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
