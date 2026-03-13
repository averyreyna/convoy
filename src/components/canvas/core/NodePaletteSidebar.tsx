import { useCallback, useRef } from 'react';
import { Sparkles, FileInput, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaletteCategory } from './NodePalette';

const PALETTE_TABS: { id: PaletteCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'AI', icon: <Sparkles size={18} /> },
  { id: 'data', label: 'Data', icon: <FileInput size={18} /> },
  { id: 'nodes', label: 'Nodes', icon: <Layers size={18} /> },
];

interface NodePaletteSidebarProps {
  activeTab: PaletteCategory | null;
  onTabToggle: (tab: PaletteCategory) => void;
}

export function NodePaletteSidebar({ activeTab, onTabToggle }: NodePaletteSidebarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (index + 1) % PALETTE_TABS.length;
        tabRefs.current[next]?.focus();
        onTabToggle(PALETTE_TABS[next].id);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (index - 1 + PALETTE_TABS.length) % PALETTE_TABS.length;
        tabRefs.current[prev]?.focus();
        onTabToggle(PALETTE_TABS[prev].id);
      }
    },
    [onTabToggle]
  );

  return (
    <div
      role="tablist"
      aria-label="Node palette categories"
      className="flex w-14 flex-col items-center justify-between rounded-xl border border-gray-200 bg-white py-3 shadow-lg"
    >
      <div className="flex flex-col items-center gap-2">
        {PALETTE_TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="palette-panel"
            id={`palette-tab-${tab.id}`}
            title={tab.label}
            onClick={() => onTabToggle(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            )}
          >
            {tab.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
