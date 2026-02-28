import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { button, caption, divider, panelSectionHeader } from '@/flank';
import type { SuggestedPipelineNode } from '@/types';
import { NodeCodePreview } from '../core/NodeCodePreview';

interface AiSuggestionListProps {
  suggestedNodes: SuggestedPipelineNode[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onApply: () => void;
}

export function AiSuggestionList({ suggestedNodes, expanded, onToggleExpanded, onApply }: AiSuggestionListProps) {
  if (!suggestedNodes.length) return null;

  return (
    <div className={cn(divider, panelSectionHeader)}>
      <button
        type="button"
        onClick={onToggleExpanded}
        className={cn(button.base, button.variants.ghost, button.sizes.sm, 'w-full justify-start text-left')}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className={caption}>
          {suggestedNodes.length} node{suggestedNodes.length !== 1 ? 's' : ''} to add
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 font-mono text-[10px]">
          {suggestedNodes.map((spec, index) => {
            const label = spec.label ?? spec.type.charAt(0).toUpperCase() + spec.type.slice(1);
            return (
              <NodeCodePreview
                key={`suggested-${index}`}
                type={spec.type}
                config={spec.config ?? {}}
                customCode={spec.customCode}
                title={label}
              />
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onApply}
        className={cn(button.base, button.variants.primary, button.sizes.md, 'w-full')}
      >
        Apply all
      </button>
    </div>
  );
}

