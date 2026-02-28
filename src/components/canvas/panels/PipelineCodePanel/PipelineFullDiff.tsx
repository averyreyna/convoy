import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { button, caption } from '@/flank';

export type FullDiffRowKind = 'unchanged' | 'removed' | 'added';

export interface FullDiffRow {
  kind: FullDiffRowKind;
  leftNum?: number;
  rightNum?: number;
  text: string;
}

interface PipelineFullDiffProps {
  hasBaseline: boolean;
  fullDiffExpanded: boolean;
  onToggleFullDiff: () => void;
  rows: FullDiffRow[] | null;
}

export function PipelineFullDiff({
  hasBaseline,
  fullDiffExpanded,
  onToggleFullDiff,
  rows,
}: PipelineFullDiffProps) {
  if (!hasBaseline) return null;

  return (
    <div className="shrink-0 border-t border-gray-200">
      <button
        type="button"
        onClick={onToggleFullDiff}
        className={cn(
          'flex w-full items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1.5 text-left',
          button.base,
          button.variants.ghost,
          button.sizes.sm
        )}
      >
        {fullDiffExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className={caption}>Diff since last run</span>
      </button>
      {fullDiffExpanded && rows && (
        <div className="grid max-h-48 grid-cols-2 gap-px overflow-auto bg-gray-200 font-mono text-[10px]">
          <div className="flex flex-col bg-gray-50">
            <div
              className={cn(
                caption,
                'sticky top-0 border-b border-gray-200 bg-white px-2 py-1'
              )}
            >
              Before (last run)
            </div>
            <div className="overflow-auto p-1.5">
              {rows.map((row, i) =>
                row.kind === 'removed' ? (
                  <div
                    key={`l-${i}`}
                    className="border-l-2 border-red-400 bg-red-50 py-0.5 pl-1.5 pr-1 text-red-900"
                  >
                    {row.text || ' '}
                  </div>
                ) : row.kind === 'unchanged' ? (
                  <div key={`l-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-700">
                    {row.text || ' '}
                  </div>
                ) : (
                  <div key={`l-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-300">
                    {' '}
                  </div>
                )
              )}
            </div>
          </div>
          <div className="flex flex-col bg-gray-50">
            <div
              className={cn(
                caption,
                'sticky top-0 border-b border-gray-200 bg-white px-2 py-1'
              )}
            >
              After (current)
            </div>
            <div className="overflow-auto p-1.5">
              {rows.map((row, i) =>
                row.kind === 'added' ? (
                  <div
                    key={`r-${i}`}
                    className="border-l-2 border-emerald-500 bg-emerald-50 py-0.5 pl-1.5 pr-1 text-emerald-900"
                  >
                    {row.text || ' '}
                  </div>
                ) : row.kind === 'unchanged' ? (
                  <div key={`r-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-700">
                    {row.text || ' '}
                  </div>
                ) : (
                  <div key={`r-${i}`} className="py-0.5 pl-1.5 pr-1 text-gray-300">
                    {' '}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
