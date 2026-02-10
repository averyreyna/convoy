import { useState, useCallback, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import type { DataFrame } from '@/types';
import {
  dataFrameToCSV,
  exportToDatawrapper,
  CONVOY_TO_DW_CHART_TYPE,
  DATAWRAPPER_CHART_TYPES,
} from '@/lib/datawrapper';

interface DatawrapperExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The pipeline output data to export */
  dataFrame: DataFrame | undefined;
  /** Chart node config, if a chart node exists in the pipeline */
  chartConfig: Record<string, unknown> | undefined;
}

type ExportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; editUrl: string; publicUrl: string | null }
  | { status: 'error'; message: string };

export function DatawrapperExportModal({
  isOpen,
  onClose,
  dataFrame,
  chartConfig,
}: DatawrapperExportModalProps) {
  // Pre-fill from chart node config
  const convoyChartType = (chartConfig?.chartType as string) || 'bar';
  const defaultDwType = CONVOY_TO_DW_CHART_TYPE[convoyChartType] || 'd3-bars';

  const [title, setTitle] = useState('');
  const [chartType, setChartType] = useState(defaultDwType);
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [byline, setByline] = useState('');
  const [publish, setPublish] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setChartType(defaultDwType);
      setSourceName('');
      setSourceUrl('');
      setByline('');
      setPublish(false);
      setExportState({ status: 'idle' });
    }
  }, [isOpen, defaultDwType]);

  const handleExport = useCallback(async () => {
    if (!dataFrame || dataFrame.rows.length === 0) {
      setExportState({
        status: 'error',
        message: 'No data available. Make sure your pipeline has run.',
      });
      return;
    }

    setExportState({ status: 'loading' });

    try {
      const csvData = dataFrameToCSV(dataFrame);

      // Build Datawrapper metadata from the form fields
      const metadata: Record<string, unknown> = {};
      const describe: Record<string, string> = {};

      if (sourceName) describe['source-name'] = sourceName;
      if (sourceUrl) describe['source-url'] = sourceUrl;
      if (byline) describe['byline'] = byline;

      if (Object.keys(describe).length > 0) {
        metadata.describe = describe;
      }

      const result = await exportToDatawrapper({
        title: title || 'Convoy Export',
        chartType,
        csvData,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        publish,
      });

      setExportState({
        status: 'success',
        editUrl: result.editUrl,
        publicUrl: result.publicUrl,
      });
    } catch (err) {
      setExportState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Export failed',
      });
    }
  }, [dataFrame, title, chartType, sourceName, sourceUrl, byline, publish]);

  if (!isOpen) return null;

  const rowCount = dataFrame?.rows.length ?? 0;
  const colCount = dataFrame?.columns.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && exportState.status !== 'loading') onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && exportState.status !== 'loading') onClose();
      }}
    >
      <div className="w-[440px] rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Send to Datawrapper
            </h2>
            {rowCount > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                {rowCount} rows, {colCount} columns
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={exportState.status === 'loading'}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {exportState.status === 'success' ? (
            <SuccessView
              editUrl={exportState.editUrl}
              publicUrl={exportState.publicUrl}
              onClose={onClose}
            />
          ) : exportState.status === 'error' ? (
            <ErrorView
              message={exportState.message}
              onRetry={() => setExportState({ status: 'idle' })}
              onClose={onClose}
            />
          ) : exportState.status === 'loading' ? (
            <LoadingView />
          ) : (
            <ExportForm
              title={title}
              setTitle={setTitle}
              chartType={chartType}
              setChartType={setChartType}
              sourceName={sourceName}
              setSourceName={setSourceName}
              sourceUrl={sourceUrl}
              setSourceUrl={setSourceUrl}
              byline={byline}
              setByline={setByline}
              publish={publish}
              setPublish={setPublish}
              onSubmit={handleExport}
              onCancel={onClose}
              hasData={rowCount > 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-views ───────────────────────────────────────────────────────────────

function ExportForm({
  title,
  setTitle,
  chartType,
  setChartType,
  sourceName,
  setSourceName,
  sourceUrl,
  setSourceUrl,
  byline,
  setByline,
  publish,
  setPublish,
  onSubmit,
  onCancel,
  hasData,
}: {
  title: string;
  setTitle: (v: string) => void;
  chartType: string;
  setChartType: (v: string) => void;
  sourceName: string;
  setSourceName: (v: string) => void;
  sourceUrl: string;
  setSourceUrl: (v: string) => void;
  byline: string;
  setByline: (v: string) => void;
  publish: boolean;
  setPublish: (v: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  hasData: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Title */}
      <FormField label="Chart title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Convoy Export"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
        />
      </FormField>

      {/* Chart type */}
      <FormField label="Chart type">
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
        >
          {DATAWRAPPER_CHART_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </FormField>

      {/* Source row */}
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Source name">
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="e.g. Census Bureau"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
          />
        </FormField>
        <FormField label="Source URL">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
          />
        </FormField>
      </div>

      {/* Byline */}
      <FormField label="Byline">
        <input
          type="text"
          value={byline}
          onChange={(e) => setByline(e.target.value)}
          placeholder="e.g. Jane Doe, The Gazette"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
        />
      </FormField>

      {/* Publish toggle */}
      <label className="flex items-center gap-2 pt-1 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-200"
        />
        Publish immediately
        <span className="text-gray-400">(otherwise opens in editor)</span>
      </label>

      {/* No data warning */}
      {!hasData && (
        <p className="text-xs text-amber-600">
          No pipeline data available yet. Run your pipeline first.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!hasData}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send to Datawrapper
        </button>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="flex items-center gap-3 py-6">
      <Loader2 size={16} className="animate-spin text-emerald-600" />
      <div>
        <p className="text-xs font-medium text-gray-700">
          Creating chart in Datawrapper...
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          Uploading data and configuring visualization
        </p>
      </div>
    </div>
  );
}

function SuccessView({
  editUrl,
  publicUrl,
  onClose,
}: {
  editUrl: string;
  publicUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
        <p className="text-xs font-medium text-emerald-800">
          Chart created successfully
        </p>
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Open in Datawrapper editor
          <ExternalLink size={11} />
        </a>
        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
          >
            View published chart
            <ExternalLink size={11} />
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        Done
      </button>
    </div>
  );
}

function ErrorView({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="rounded-lg border border-red-100 bg-red-50 p-3">
        <p className="text-xs font-medium text-red-800">Export failed</p>
        <p className="mt-1 text-xs text-red-600">{message}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Try Again
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
