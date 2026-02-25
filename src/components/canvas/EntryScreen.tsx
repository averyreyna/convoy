import { useState } from 'react';
import { FileCode, Database, Loader2, X } from 'lucide-react';
import { SAMPLE_DATASETS, loadSampleIntoDataSource, type SampleDataset } from '@/lib/sampleData';

interface EntryScreenProps {
  onOpenPrompt: () => void;
  onOpenImportPython: () => void;
  /** When provided, the card is shown on the canvas and can be dismissed (close button). */
  onDismiss?: () => void;
}

export function EntryScreen({
  onOpenPrompt,
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
      onOpenPrompt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample');
    } finally {
      setLoadingSampleId(null);
    }
  };

  return (
    <div className="flex items-center justify-center p-6">
      <div className={`relative w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-lg ${onDismiss ? 'pt-10' : ''}`}>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        )}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-gray-900">
            Describe your data or visualization
          </h1>
          <p className="text-sm text-gray-500">
            Start with a sample dataset, or paste code to import a pipeline.
          </p>
        </div>

        {/* Sample datasets */}
        <div className="mb-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
            Use a sample dataset
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {SAMPLE_DATASETS.map((sample) => {
              const isLoading = loadingSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleClick(sample)}
                  disabled={loadingSampleId != null}
                  className="flex flex-col items-start rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md disabled:opacity-60"
                >
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <Database size={20} className="text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900">{sample.label}</span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                    {sample.description}
                  </span>
                  {isLoading && (
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
                      <Loader2 size={14} className="animate-spin" />
                      Loading…
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Import code */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
            Or import code
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenImportPython}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/50"
            >
              <FileCode size={18} className="text-emerald-600" />
              Import from Python
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          After choosing a sample, describe what you want and we'll build the pipeline.
        </p>
      </div>
    </div>
  );
}
