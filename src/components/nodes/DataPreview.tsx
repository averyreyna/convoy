import { useState } from 'react';
import { ChevronDown, ChevronRight, Table2 } from 'lucide-react';
import type { DataFrame } from '@/types';

/** Maximum rows to render in the preview table for large datasets (keeps UI fast). */
const PREVIEW_ROW_CAP = 500;

interface DataPreviewProps {
  /** The DataFrame to preview */
  data: DataFrame | undefined;
  /** Maximum rows to display (default: 5) */
  maxRows?: number;
  /** Maximum columns to display (default: 5) */
  maxCols?: number;
  /** Label shown in the toggle header */
  label?: string;
}

/**
 * Compact, collapsible data preview table for transformation nodes.
 * Shows the first N rows of a node's output DataFrame so users can
 * inspect data at each step of the pipeline.
 */
export function DataPreview({
  data,
  maxRows = 5,
  maxCols = 5,
  label = 'Output preview',
}: DataPreviewProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!data || data.rows.length === 0) return null;

  const totalRows = data.rows.length;
  const cappedMaxRows = Math.min(maxRows, PREVIEW_ROW_CAP, totalRows);
  const displayColumns = data.columns.slice(0, maxCols);
  const displayRows = data.rows.slice(0, cappedMaxRows);
  const hasMoreCols = data.columns.length > maxCols;
  const hasMoreRows = totalRows > cappedMaxRows;
  const isLargeDataset = totalRows > PREVIEW_ROW_CAP;

  return (
    <div className="space-y-1">
      {/* Toggle header */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex w-full items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
      >
        {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Table2 size={10} />
        {label}
        <span className="ml-auto font-normal normal-case">
          {data.rows.length.toLocaleString()} rows &times; {data.columns.length} cols
        </span>
      </button>

      {/* Table */}
      {isOpen && (
        <div className="max-h-36 overflow-auto rounded border border-gray-100 text-[10px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                {displayColumns.map((col) => (
                  <th
                    key={col.name}
                    className="whitespace-nowrap px-2 py-1 text-left font-medium text-gray-500"
                  >
                    {col.name}
                  </th>
                ))}
                {hasMoreCols && (
                  <th className="px-2 py-1 text-left font-medium text-gray-300">
                    ...
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  {displayColumns.map((col) => (
                    <td
                      key={col.name}
                      className="max-w-[80px] truncate whitespace-nowrap px-2 py-1 text-gray-600"
                      title={String(row[col.name] ?? '')}
                    >
                      {row[col.name] === null || row[col.name] === undefined
                        ? '—'
                        : String(row[col.name])}
                    </td>
                  ))}
                  {hasMoreCols && (
                    <td className="px-2 py-1 text-gray-300">...</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Row count footer: for large datasets show "first N of M", else "N of M" */}
      {isOpen && hasMoreRows && (
        <div className="text-center text-[10px] text-gray-300">
          {isLargeDataset
            ? `Showing first ${displayRows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows`
            : `Showing ${displayRows.length} of ${totalRows.toLocaleString()} rows`}
        </div>
      )}
    </div>
  );
}
