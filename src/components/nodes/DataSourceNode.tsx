import { useCallback, useRef, useState, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import Papa from 'papaparse';
import {
  Table, Upload, FileSpreadsheet, X, ClipboardPaste, Globe, Loader2,
  Database, FlipVertical2, MessageSquareWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { button, input, spinnerLg, dropZoneDefault, dropZoneActive, tableContainer, tableHeader } from '@/design-system';
import { useDataStore } from '@/stores/dataStore';
import type { DataSourceNodeData, Column, DataFrame } from '@/types';

/**
 * Sample datasets bundled with Convoy for quick testing.
 */
const SAMPLE_DATASETS = [
  {
    id: 'gapminder',
    label: 'Gapminder',
    description: '120 rows — country, GDP, life expectancy over time',
    path: '/data/gapminder.csv',
    icon: Database,
    hint: 'Try: Filter → GroupBy → Sort → Bar chart',
  },
  {
    id: 'energy',
    label: 'Energy Production',
    description: '40 rows — wide format, energy sources by country',
    path: '/data/energy-production.csv',
    icon: FlipVertical2,
    hint: 'Try: Reshape (unpivot) → GroupBy → Area chart',
  },
  {
    id: 'nyc311',
    label: 'NYC 311 Complaints',
    description: '150 rows — complaint types, boroughs, resolution times',
    path: '/data/nyc-311-complaints.csv',
    icon: MessageSquareWarning,
    hint: 'Try: Filter "Noise" → GroupBy borough → Bar chart',
  },
] as const;

type DataSourceNodeProps = NodeProps & {
  data: DataSourceNodeData;
};

/**
 * Infer a Column type from a sample value.
 */
function inferColumnType(value: unknown): Column['type'] {
  if (value === null || value === undefined || value === '') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  // Check for date-like strings
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(Date.parse(str))) return 'date';
  return 'string';
}

export function DataSourceNode({ id, data, selected }: DataSourceNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const setNodeData = useDataStore((s) => s.setNodeData);
  const setNodeOutput = useDataStore((s) => s.setNodeOutput);
  const storedData = useDataStore((s) => s.nodeData[id]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const handleFileUpload = useCallback(
    (file: File) => {
      setParseError(null);
      setIsParsing(true);

      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);

          if (results.errors.length > 0 && results.data.length === 0) {
            setParseError(results.errors[0]?.message || 'Failed to parse CSV');
            updateNode(id, { state: 'error', error: 'Parse failed' });
            return;
          }

          // Filter out completely empty rows
          const validRows = (results.data as Record<string, unknown>[]).filter(
            (row) => Object.values(row).some((v) => v !== null && v !== undefined && v !== '')
          );

          // Detect columns and types from first non-empty row
          const firstRow = validRows[0] || {};
          const columns: Column[] = Object.keys(firstRow).map((name) => ({
            name,
            type: inferColumnType(firstRow[name]),
          }));

          // Store full data for downstream nodes
          setNodeData(id, {
            rows: validRows,
            columns,
            fileName: file.name,
            rowCount: validRows.length,
          });

          // Also store as generic DataFrame output for downstream execution
          const output: DataFrame = { columns, rows: validRows };
          setNodeOutput(id, output);

          // Update the node's visual data
          updateNode(id, {
            fileName: file.name,
            rowCount: validRows.length,
            columns,
            state: 'confirmed',
            error: undefined,
          });
        },
        error: (error: Error) => {
          setIsParsing(false);
          setParseError(error.message);
          updateNode(id, { state: 'error', error: error.message });
        },
      });
    },
    [id, setNodeData, setNodeOutput, updateNode]
  );

  /**
   * Parse raw CSV/TSV text and store it as the node's data.
   */
  const processCSVText = useCallback(
    (text: string, sourceName: string) => {
      setParseError(null);
      setIsParsing(true);

      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);

          if (results.errors.length > 0 && results.data.length === 0) {
            setParseError(results.errors[0]?.message || 'Failed to parse data');
            updateNode(id, { state: 'error', error: 'Parse failed' });
            return;
          }

          const validRows = (results.data as Record<string, unknown>[]).filter(
            (row) => Object.values(row).some((v) => v !== null && v !== undefined && v !== '')
          );

          if (validRows.length === 0) {
            setParseError('No data rows found');
            return;
          }

          const firstRow = validRows[0] || {};
          const columns: Column[] = Object.keys(firstRow).map((name) => ({
            name,
            type: inferColumnType(firstRow[name]),
          }));

          setNodeData(id, {
            rows: validRows,
            columns,
            fileName: sourceName,
            rowCount: validRows.length,
          });

          const output: DataFrame = { columns, rows: validRows };
          setNodeOutput(id, output);

          updateNode(id, {
            fileName: sourceName,
            rowCount: validRows.length,
            columns,
            state: 'confirmed',
            error: undefined,
          });
        },
        error: (error: Error) => {
          setIsParsing(false);
          setParseError(error.message);
          updateNode(id, { state: 'error', error: error.message });
        },
      });
    },
    [id, setNodeData, setNodeOutput, updateNode]
  );

  /**
   * Paste handler — reads clipboard text (TSV from spreadsheets, or CSV).
   */
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setParseError('Clipboard is empty');
        return;
      }
      processCSVText(text, 'pasted-data.csv');
    } catch {
      setParseError('Could not read clipboard. Try Ctrl+V / Cmd+V instead.');
    }
  }, [processCSVText]);

  /**
   * URL import handler — fetches CSV via server proxy.
   */
  const handleUrlImport = useCallback(async () => {
    if (!urlValue.trim()) return;

    setIsLoadingUrl(true);
    setParseError(null);

    try {
      const res = await fetch(`/api/fetch-csv?url=${encodeURIComponent(urlValue.trim())}`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const csvText = await res.text();
      const urlName = urlValue.split('/').pop()?.split('?')[0] || 'url-data.csv';
      processCSVText(csvText, urlName);
      setShowUrlInput(false);
      setUrlValue('');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setIsLoadingUrl(false);
    }
  }, [urlValue, processCSVText]);

  /**
   * Sample dataset loader — fetches a bundled CSV from public/data/.
   */
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const handleLoadSample = useCallback(
    async (sample: (typeof SAMPLE_DATASETS)[number]) => {
      setLoadingSample(sample.id);
      setParseError(null);

      try {
        const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';
        const url = base + (sample.path.startsWith('/') ? sample.path : `/${sample.path}`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load sample: ${res.status} ${res.statusText}`);
        const csvText = await res.text();
        const fileName = sample.path.split('/').pop() || `${sample.id}.csv`;
        processCSVText(csvText, fileName);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to load sample');
      } finally {
        setLoadingSample(null);
      }
    },
    [processCSVText]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // Ignore React Flow node drags (from palette)
      if (e.dataTransfer.getData('application/reactflow')) return;

      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
        handleFileUpload(file);
      } else if (file) {
        setParseError('Please upload a CSV file');
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drag-over for file drops, not React Flow node drags
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      // Reset so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFileUpload]
  );

  const handleClearFile = useCallback(() => {
    useDataStore.getState().removeNodeData(id);
    useDataStore.getState().removeNodeOutput(id);
    updateNode(id, {
      fileName: undefined,
      rowCount: undefined,
      columns: undefined,
      state: 'proposed',
      error: undefined,
    });
    setParseError(null);
  }, [id, updateNode]);

  // Get preview rows from stored data
  const previewRows = storedData?.rows.slice(0, 5) ?? [];
  const displayColumns = data.columns?.slice(0, 5) ?? [];

  // Config object for the AI explanation
  const explanationConfig = useMemo(
    () => ({
      fileName: data.fileName,
      rowCount: data.rowCount,
      columnCount: data.columns?.length,
      columns: data.columns?.map((c) => c.name),
    }),
    [data.fileName, data.rowCount, data.columns]
  );

  return (
    <BaseNode
      nodeId={id}
      state={data.state}
      title="Data Source"
      icon={<Table size={16} />}
      selected={selected}
      inputs={0}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="dataSource"
      nodeConfig={explanationConfig}
    >
      {!data.fileName ? (
        /* Upload zone */
        <div className="space-y-2">
          <div
            className={cn(
              isDragOver ? dropZoneActive : dropZoneDefault,
              'flex flex-col items-center justify-center'
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isParsing ? (
              <>
                <div className={cn(spinnerLg, 'mb-2')} />
                <span className="text-xs text-gray-500">Parsing data...</span>
              </>
            ) : (
              <>
                <Upload
                  className={`mb-2 ${isDragOver ? 'text-blue-400' : 'text-gray-300'}`}
                  size={24}
                />
                <span className="text-xs font-medium text-gray-500">
                  Drop CSV file here
                </span>
                <button
                  onClick={handleBrowseClick}
                  className="mt-1.5 text-xs font-medium text-blue-500 hover:text-blue-600 hover:underline"
                >
                  or browse files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </>
            )}
          </div>

          {/* Paste + URL import buttons */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePaste();
              }}
              className={cn(button.base, button.variants.secondary, button.sizes.sm, 'flex-1')}
            >
              <ClipboardPaste size={10} />
              Paste data
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowUrlInput(!showUrlInput);
              }}
              className={cn(
                button.base,
                showUrlInput ? 'border-blue-300 bg-blue-50 text-blue-600' : button.variants.secondary,
                button.sizes.sm,
                'flex-1'
              )}
            >
              <Globe size={10} />
              From URL
            </button>
          </div>

          {/* URL input */}
          {showUrlInput && (
            <div className="flex gap-1">
              <input
                type="text"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUrlImport();
                }}
                placeholder="https://example.com/data.csv"
                className={cn(input.default, 'min-w-0 flex-1')}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUrlImport();
                }}
                disabled={isLoadingUrl || !urlValue.trim()}
                className={cn(button.base, button.variants.primary, button.sizes.sm, 'disabled:opacity-50')}
              >
                {isLoadingUrl ? <Loader2 size={10} className="animate-spin" /> : 'Load'}
              </button>
            </div>
          )}

          {/* Sample datasets */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Try a sample dataset
            </div>
            <div className="space-y-1">
              {SAMPLE_DATASETS.map((sample) => {
                const Icon = sample.icon;
                const isLoading = loadingSample === sample.id;
                return (
                  <button
                    key={sample.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample(sample);
                    }}
                    disabled={loadingSample !== null}
                    className="flex w-full items-start gap-2 rounded-md border border-gray-100 px-2 py-1.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 disabled:opacity-50"
                  >
                    <span className="mt-0.5 flex-shrink-0 text-gray-400">
                      {isLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Icon size={12} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium text-gray-700">
                        {sample.label}
                      </div>
                      <div className="text-[9px] text-gray-400">
                        {sample.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {parseError && (
            <div className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-500">
              {parseError}
            </div>
          )}
        </div>
      ) : (
        /* File loaded: show metadata + preview */
        <div className="space-y-2">
          {/* File info header */}
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={14} className="flex-shrink-0 text-green-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-gray-700">
                {data.fileName}
              </div>
              <div className="text-[10px] text-gray-400">
                {data.rowCount?.toLocaleString()} rows &middot;{' '}
                {data.columns?.length} columns
              </div>
            </div>
            <button
              onClick={handleClearFile}
              className="flex-shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
              aria-label="Remove file"
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>

          {/* Column type chips */}
          {data.columns && (
            <div className="flex flex-wrap gap-1">
              {data.columns.slice(0, 6).map((col) => (
                <span
                  key={col.name}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px]"
                  title={`${col.name} (${col.type})`}
                >
                  <span className="font-medium text-gray-600">{col.name}</span>
                  <span className="text-gray-400">{col.type}</span>
                </span>
              ))}
              {data.columns.length > 6 && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                  +{data.columns.length - 6} more
                </span>
              )}
            </div>
          )}

          {/* Mini preview table */}
          {previewRows.length > 0 && displayColumns.length > 0 && (
            <div className={cn(tableContainer, 'max-h-36')}>
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr>
                    {displayColumns.map((col) => (
                      <th
                        key={col.name}
                        className={cn(tableHeader, 'whitespace-nowrap text-left')}
                      >
                        {col.name}
                      </th>
                    ))}
                    {(data.columns?.length ?? 0) > 5 && (
                      <th className="px-2 py-1 text-left font-medium text-gray-300">
                        ...
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
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
                      {(data.columns?.length ?? 0) > 5 && (
                        <td className="px-2 py-1 text-gray-300">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Row count footer */}
          {previewRows.length > 0 && (
            <div className="text-center text-[10px] text-gray-300">
              Showing {previewRows.length} of {data.rowCount?.toLocaleString()} rows
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
}
