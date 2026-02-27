import { cn } from '@/lib/utils';
import { headingLg, captionMuted, panelSectionHeader } from '@/design-system';

export function SidebarHeader() {
  return (
    <div className={cn('relative shrink-0', panelSectionHeader)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={headingLg}>Convoy</h2>
          <p className={cn('mt-0.5', captionMuted)}>
            Click a node type to add it to the canvas
          </p>
        </div>
      </div>
    </div>
  );
}
