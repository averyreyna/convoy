import { useState, useRef } from 'react';
import { Settings } from 'lucide-react';
import { PreferencesPanel } from './PreferencesPanel';

export function SidebarHeader() {
  const [showPrefs, setShowPrefs] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative shrink-0 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Convoy</h2>
          <p className="mt-0.5 text-[10px] text-gray-400">
            Drag nodes onto the canvas
          </p>
        </div>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setShowPrefs((v) => !v)}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
      <PreferencesPanel
        isOpen={showPrefs}
        onClose={() => setShowPrefs(false)}
        anchorRef={anchorRef}
      />
    </div>
  );
}
