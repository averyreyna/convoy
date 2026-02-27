import { Layers, CheckCheck, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { button, captionMedium, banner, dividerVertical } from '@/design-system';

export function ProposedPipelineBanner() {
  const nodes = useCanvasStore((s) => s.nodes);
  const confirmAllProposed = useCanvasStore((s) => s.confirmAllProposed);
  const clearProposed = useCanvasStore((s) => s.clearProposed);

  const proposedCount = nodes.filter((n) => n.data.state === 'proposed').length;

  if (proposedCount === 0) return null;

  return (
    <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2">
      <div className={cn(banner, 'flex items-center gap-3')}>
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-blue-500" />
          <span className={captionMedium}>
            {proposedCount} proposed {proposedCount === 1 ? 'node' : 'nodes'}
          </span>
        </div>

        <div className={cn(dividerVertical, 'h-4')} />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={confirmAllProposed}
            className={cn(button.base, button.variants.primary, button.sizes.sm)}
          >
            <CheckCheck size={14} />
            Confirm all
          </button>
          <button
            type="button"
            onClick={clearProposed}
            className={cn(button.base, button.variants.secondary, button.sizes.sm, 'hover:text-red-600 active:bg-gray-100')}
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={clearProposed}
          className={cn(button.base, button.variants.ghost, 'ml-1 rounded-full p-1')}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
