import { useRef, useEffect } from 'react';
import { HelpCircle, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIExplanation } from '@/hooks/useAIExplanation';
import { button, card, label, alert, caption, spinner, mutedBox, mutedBoxRow } from '@/flank';

interface ExplanationPopoverProps {
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  inputRowCount?: number;
  outputRowCount?: number;
}

/**
 * Ephemeral AI explanation popover for nodes.
 * Shows a "?" icon on hover (via group-hover), and when clicked opens a popover
 * with a plain-language explanation of what the node does.
 * Closes on Escape key or clicking outside.
 */
export function ExplanationPopover({
  nodeType,
  nodeConfig,
  inputRowCount,
  outputRowCount,
}: ExplanationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { explanation, isLoading, isOpen, error, show, hide } = useAIExplanation({
    nodeType,
    nodeConfig,
    inputRowCount,
    outputRowCount,
  });

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hide]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        hide();
      }
    };

    // Use a timeout to avoid closing immediately from the same click that opens it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, hide]);

  return (
    <div className="relative">
      {/* "?" button — visible on hover via group-hover */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            hide();
          } else {
            show();
          }
        }}
        className={cn(button.base, button.variants.ghost, 'rounded-full p-0.5 opacity-0 transition-opacity hover:text-blue-500 group-hover:opacity-100')}
        aria-label="Explain this step"
        title="Explain this step"
      >
        <HelpCircle size={14} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(card.base, 'absolute right-0 top-full z-50 mt-2 w-64 p-3')}
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <span className={label}>
              What this does
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hide();
              }}
              className={cn(button.base, button.variants.ghost, 'rounded p-0.5')}
              aria-label="Close explanation"
            >
              <X size={12} />
            </button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className={cn('flex items-center gap-2 py-1 text-sm', caption)}>
              <div className={spinner} />
              Thinking...
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className={cn(alert, 'flex items-start gap-2 !mb-0')}>
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Explanation text */}
          {explanation && !isLoading && !error && (
            <p className="text-sm leading-relaxed text-gray-700">{explanation}</p>
          )}

          {/* Row count transformation */}
          {inputRowCount !== undefined && outputRowCount !== undefined && (
            <div className={cn(mutedBox, mutedBoxRow, caption, 'mt-2')}>
              <span>{inputRowCount.toLocaleString()} rows</span>
              <span className="text-gray-300">→</span>
              <span className="font-medium text-gray-700">
                {outputRowCount.toLocaleString()} rows
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
