import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaletteCategory } from './NodePalette';

interface NodePaletteSidebarProps {
  activeTab: PaletteCategory | null;
  onTabToggle: (tab: PaletteCategory) => void;
}

export function NodePaletteSidebar({ activeTab, onTabToggle }: NodePaletteSidebarProps) {
  const isOpen = activeTab === 'nodes';

  return (
    <div className="flex w-14 flex-col items-center justify-between rounded-xl border border-gray-200 bg-white py-3 shadow-lg">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="palette-panel"
        id="palette-tab-nodes"
        title="Nodes"
        onClick={() => onTabToggle('nodes')}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg text-xs font-medium transition-colors',
          isOpen
            ? 'bg-gray-900 text-white shadow-sm'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        )}
      >
        <Layers size={18} />
      </button>
    </div>
  );
}
