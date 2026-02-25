import { useState } from 'react';
import { FileCode, Database, Loader2, X, Sparkles } from 'lucide-react';
import { SAMPLE_DATASETS, loadSampleIntoDataSource, type SampleDataset } from '@/lib/sampleData';

interface EntryScreenProps {
  onOpenImportPython: () => void;
  /** When provided, the card is shown on the canvas and can be dismissed (close button). */
  onDismiss?: () => void;
}

export function EntryScreen({
  onOpenImportPython,
  onDismiss,
}: EntryScreenProps) {
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSampleClick = async (sample: SampleDataset) => {
    setError(null);
    setLoadingSampleId(sample.id);
    const nodeId = `entry-${Date.now()}`;
    try {
      await loadSampleIntoDataSource(nodeId, sample);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample');
    } finally {
      setLoadingSampleId(null);
    }
  };

  return (
    <div className="flex items-center justify-center p-5">
      <div className={`relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg ${onDismiss ? 'pt-10' : ''}`}>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2.5 top-2.5 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        )}

        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Sparkles size={18} />
          </span>
          <h2 className="text-base font-semibold text-gray-900">
            Data or visualization
          </h2>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Choose a sample dataset or import your own, then describe what you want to build.
        </p>

        {/* Sample datasets — icon-first row */}
        <div className="mb-4">
          <div className="flex gap-3">
            {SAMPLE_DATASETS.map((sample) => {
              const isLoading = loadingSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleClick(sample)}
                  disabled={loadingSampleId != null}
                  title={sample.description}
                  className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/80 py-3.5 transition-all hover:border-blue-200 hover:bg-blue-50/50 disabled:opacity-60"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
                    {isLoading ? (
                      <Loader2 size={22} className="animate-spin text-blue-600" />
                    ) : (
                      <Database size={22} className="text-gray-600" />
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    {sample.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Import — single icon button */}
        <div className="flex flex-col items-center gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onOpenImportPython}
            title="Import from Python"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/50"
          >
            <FileCode size={18} className="text-emerald-600" />
            Python
          </button>
          <p className="text-center text-[11px] text-gray-400">
            We'll add your data to the canvas, then you can describe your goal and we'll build the pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
