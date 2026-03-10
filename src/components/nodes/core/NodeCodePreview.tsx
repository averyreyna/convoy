import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { caption, button, card } from '@/flank';
import { generateNodeCode } from '@/lib/codeGenerators';

const TEASER_MAX_CHARS = 56;

interface NodeCodePreviewProps {
  type: string;
  config: Record<string, unknown>;
  customCode?: string;
  title?: ReactNode;
  className?: string;
}

function getTeaser(code: string): string {
  const firstLine = code.split('\n')[0]?.trim() ?? '';
  if (firstLine.length <= TEASER_MAX_CHARS) return firstLine;
  return firstLine.slice(0, TEASER_MAX_CHARS - 1) + '…';
}

export function NodeCodePreview({ type, config, customCode, title, className }: NodeCodePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const code =
    typeof customCode === 'string' && customCode.trim() !== ''
      ? customCode
      : generateNodeCode(type, config ?? {});

  const teaser = getTeaser(code);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative rounded border border-gray-200 bg-gray-50 p-2', className)}>
      {title && <div className="mb-1 font-medium text-gray-700">{title}</div>}
      <div className={caption}>Code</div>

      {/* Teaser: first line + "View code" — click to open popover */}
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        className={cn(
          'mt-0.5 flex w-full items-center gap-2 rounded bg-gray-100 px-1.5 py-1 text-left',
          'hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300'
        )}
        title="View full code"
      >
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-gray-800">
          {teaser}
        </span>
        <span className={cn(caption, 'flex-shrink-0 text-gray-500')}>
          View code
        </span>
      </button>

      {/* Popover: full code */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            card.base,
            'absolute left-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-24px))] p-0 shadow-lg'
          )}
          role="dialog"
          aria-label="Code preview"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-xs font-medium text-gray-700">Code</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              className={cn(button.base, button.variants.ghost, 'rounded p-0.5')}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <pre className="max-h-[min(320px,60vh)] overflow-auto whitespace-pre-wrap px-3 py-2 text-[11px] font-mono text-gray-800">
            {code}
          </pre>
        </div>
      )}
    </div>
  );
}
