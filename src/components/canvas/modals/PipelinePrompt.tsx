import { useState, useCallback, useEffect, useRef } from 'react';
import { Wand2, ArrowRight, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { generatePipeline } from '@/lib/api';
import {
  modalOverlay,
  modalPanel,
  headingBase,
  caption,
  button,
  input,
  alert,
  alertWarning,
  spinner,
  iconWell,
  mutedBox,
} from '@/flank';

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
          : 'Failed to build pipeline. Please try again.'
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
      className={modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn(modalPanel, 'w-full max-w-lg p-6')}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(iconWell, 'h-8 w-8')}>
              <Wand2 className="text-blue-500" size={18} />
            </div>
            <div>
              <h2 className={headingBase}>
                What do you want to visualize?
              </h2>
              <p className={caption}>
                Describe in plain English and we'll build the pipeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(button.base, button.variants.ghost, button.sizes.md)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Data schema indicator */}
        {dataSchema ? (
          <div className={cn(mutedBox, 'mb-3')}>
            <p className={caption}>
              <span className="font-medium text-gray-700">
                Available columns:
              </span>{' '}
              {dataSchema.columns.map((c) => c.name).join(', ')}
            </p>
          </div>
        ) : (
          <div className={cn(alertWarning, 'mb-3 flex items-start gap-2')}>
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <p className="text-xs">
              Add a Data Source node and upload a CSV file first to get
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
          className={cn(input.default, 'mb-3 h-24 resize-none text-sm')}
          disabled={isLoading}
        />

        {/* Example prompts */}
        <div className="mb-4">
          <p className={cn('mb-2', caption)}>Try an example:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setPrompt(example);
                  setError(null);
                }}
                disabled={isLoading}
                className={cn(button.base, button.variants.secondary, button.sizes.sm, 'rounded-full disabled:opacity-50')}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className={cn(alert, 'mb-3 flex items-start gap-2')}>
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs">{error}</p>
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
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className={cn(button.base, button.variants.secondary, button.sizes.md, 'disabled:opacity-50')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading || !dataSchema}
              className={cn(button.base, button.variants.primary, button.sizes.md, 'disabled:cursor-not-allowed disabled:opacity-50')}
            >
              {isLoading ? (
                <>
                  <div className={cn(spinner, 'border-white/30 border-t-white')} />
                  Building...
                </>
              ) : (
                <>
                  Build pipeline
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
