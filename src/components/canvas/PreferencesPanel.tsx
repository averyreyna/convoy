import { useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { card, label, panelSection, panelSectionHeader, checkbox } from '@/design-system';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function PreferencesPanel({
  isOpen,
  onClose,
  anchorRef,
}: PreferencesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const showCodeByDefault = usePreferencesStore((s) => s.showCodeByDefault);
  const setShowCodeByDefault = usePreferencesStore((s) => s.setShowCodeByDefault);
  const suggestNextSteps = usePreferencesStore((s) => s.suggestNextSteps);
  const setSuggestNextSteps = usePreferencesStore((s) => s.setSuggestNextSteps);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(card.base, 'absolute left-0 top-full z-50 mt-1 w-64 border py-2')}
    >
      <div className={panelSection}>
        <p className={label}>Settings</p>
      </div>
      <div className={cn('space-y-1', panelSectionHeader)}>
        <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5">
          <span className={cn(label, 'normal-case font-normal text-gray-700')}>
            Show code by default in nodes
          </span>
          <input
            type="checkbox"
            checked={showCodeByDefault}
            onChange={(e) => setShowCodeByDefault(e.target.checked)}
            className={checkbox}
          />
        </label>
        <div className="py-1.5">
          <span className={cn('block', label, 'normal-case font-normal text-gray-700')}>
            Default script language
          </span>
          <span className="mt-1 block text-xs font-medium text-gray-800">Python</span>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5">
          <span className={cn(label, 'normal-case font-normal text-gray-700')}>Suggest next steps</span>
          <input
            type="checkbox"
            checked={suggestNextSteps}
            onChange={(e) => setSuggestNextSteps(e.target.checked)}
            className={checkbox}
          />
        </label>
      </div>
    </div>
  );
}
