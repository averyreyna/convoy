/**
 * Datawrapper integration utilities.
 * Handles DataFrame → CSV serialization, chart type mapping, and API calls
 * to the backend Datawrapper proxy.
 */

import type { DataFrame } from '@/types';

// ─── Chart Type Mapping ──────────────────────────────────────────────────────

/** Convoy chart type → Datawrapper visualization type */
export const CONVOY_TO_DW_CHART_TYPE: Record<string, string> = {
  bar: 'd3-bars',
  line: 'd3-lines',
  area: 'd3-areas',
  scatter: 'd3-scatter-plot',
  pie: 'd3-pies',
};

/** All Datawrapper chart types available for override in the export modal */
export const DATAWRAPPER_CHART_TYPES = [
  { value: 'd3-bars', label: 'Bar Chart' },
  { value: 'd3-bars-stacked', label: 'Stacked Bar Chart' },
  { value: 'd3-bars-split', label: 'Split Bar Chart' },
  { value: 'd3-lines', label: 'Line Chart' },
  { value: 'd3-areas', label: 'Area Chart' },
  { value: 'd3-scatter-plot', label: 'Scatter Plot' },
  { value: 'd3-pies', label: 'Pie Chart' },
  { value: 'd3-donuts', label: 'Donut Chart' },
  { value: 'tables', label: 'Table' },
];

// ─── DataFrame → CSV ─────────────────────────────────────────────────────────

/**
 * Convert a Convoy DataFrame into a CSV string suitable for Datawrapper upload.
 * Handles quoting for values that contain commas, quotes, or newlines.
 */
export function dataFrameToCSV(data: DataFrame): string {
  const columnNames = data.columns.map((c) => c.name);

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Quote if the value contains a comma, double-quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columnNames.map(escapeCell).join(',');
  const rows = data.rows.map((row) =>
    columnNames.map((col) => escapeCell(row[col])).join(',')
  );

  return [header, ...rows].join('\n');
}

// ─── API Client ──────────────────────────────────────────────────────────────

export interface DatawrapperExportParams {
  title: string;
  chartType: string;
  csvData: string;
  metadata?: {
    describe?: {
      'source-name'?: string;
      'source-url'?: string;
      intro?: string;
      byline?: string;
    };
    visualize?: Record<string, unknown>;
    [key: string]: unknown;
  };
  publish?: boolean;
}

export interface DatawrapperExportResult {
  chartId: string;
  editUrl: string;
  publicUrl: string | null;
}

/**
 * Check whether the Datawrapper API token is configured on the server.
 */
export async function checkDatawrapperStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/datawrapper/status');
    if (!res.ok) return false;
    const data: { configured: boolean } = await res.json();
    return data.configured;
  } catch {
    return false;
  }
}

/**
 * Export data to Datawrapper via the backend proxy.
 * Creates a chart, uploads CSV data, configures metadata, and optionally publishes.
 */
export async function exportToDatawrapper(
  params: DatawrapperExportParams
): Promise<DatawrapperExportResult> {
  const response = await fetch('/api/datawrapper/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Datawrapper export failed (${response.status})`);
  }

  return response.json();
}
