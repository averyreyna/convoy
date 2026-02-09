import { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, X, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { generatePipeline } from '@/lib/api';

const EXAMPLE_PROMPTS = [
  'Show me a bar chart of values by category',
  'Create a line chart of trends over time',
  'Compare totals across different groups',
  'Show the top 10 items sorted by value',
];

interface PipelinePromptProps {
  onClose: () => void;
}

export function PipelinePrompt({ onClose }: PipelinePromptProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addProposedPipeline = useCanvasStore((s) => s.addProposedPipeline);
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeData = useDataStore((s) => s.nodeData);

  // Find the data schema from the first DataSource node that has data
  const dataSchema = (() => {
    const dataSourceNode = nodes.find(
      (n) => n.type === 'dataSource' && n.data.state === 'confirmed'
    );
    if (!dataSourceNode) return null;

    const data = nodeData[dataSourceNode.id];
    if (!data) return null;

    return { columns: data.columns };
  })();

  // Auto-focus the textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return;

    if (!dataSchema) {
      setError(
        'Please add a Data Source node and upload a CSV file before generating a pipeline.'
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pipeline = await generatePipeline(prompt, dataSchema);
      addProposedPipeline(pipeline);
      onClose();
    } catch (err) {
      console.error('Failed to generate pipeline:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate pipeline. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [prompt, dataSchema, addProposedPipeline, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <Sparkles className="text-blue-500" size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                What do you want to visualize?
              </h2>
              <p className="text-xs text-gray-500">
                Describe in plain English and AI will build the pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Data schema indicator */}
        {dataSchema ? (
          <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">
                Available columns:
              </span>{' '}
              {dataSchema.columns.map((c) => c.name).join(', ')}
            </p>
          </div>
        ) : (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">
              Add a Data Source node and upload a CSV file first to enable AI
              pipeline suggestions.
            </p>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Show me a bar chart of sales by region, sorted by total revenue..."
          className="mb-3 h-24 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          disabled={isLoading}
        />

        {/* Example prompts */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-gray-500">Try an example:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setPrompt(example);
                  setError(null);
                }}
                disabled={isLoading}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to
            submit
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading || !dataSchema}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  Generate pipeline
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
