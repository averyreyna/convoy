import type { NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { CanvasNoteNodeData } from '@/types';
import { card, caption } from '@/flank';

type CanvasNoteNodeProps = NodeProps & {
  data: CanvasNoteNodeData;
};

export function CanvasNoteNode({ data, selected }: CanvasNoteNodeProps) {
  const content = data.content ?? '';
  const title = data.title;
  const sourceLabel = data.sourceLabel;
  const noteKind = data.noteKind;
  const showHeader = title || sourceLabel || noteKind;

  return (
    <div
      className={cn(
        'relative min-w-[260px] max-w-[320px] overflow-hidden',
        card.base,
        card.stateVariants.confirmed,
        selected && card.selected,
        'border-l-4 border-l-amber-400'
      )}
    >
      {showHeader && (
        <div className="border-b border-gray-200 bg-amber-50/80 px-3 py-1.5">
          {title && (
            <p className={cn(caption, 'font-medium text-amber-900')}>{title}</p>
          )}
          {sourceLabel && !title && (
            <p className={cn(caption, 'text-amber-800')}>From: {sourceLabel}</p>
          )}
          {sourceLabel && title && (
            <p className={cn(caption, 'text-amber-700 mt-0.5')}>From: {sourceLabel}</p>
          )}
        </div>
      )}
      <div
        className="p-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
        role="article"
      >
        {content || 'No content'}
      </div>
    </div>
  );
}
