import { useState, useCallback, useEffect, useRef } from 'react';
import { FileCode, ArrowRight, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { importPipelineFromPython } from '@/lib/api';
import {
  modalOverlay,
  modalPanel,
  modalHeader,
  headingBase,
  caption,
  button,
  input,
  alert,
  spinner,
} from '@/flank';

// Matches sample dataset: public/data/gapminder.csv (country, continent, year, population, gdpPerCapita, lifeExpectancy)
const EXAMPLE_SNIPPET = `import pandas as pd
df = pd.read_csv("gapminder.csv")
df = df[df["lifeExpectancy"] > 70]
df = df.sort_values("gdpPerCapita", ascending=False)`;

interface ImportFromPythonModalProps {
  onClose: () => void;
}

export function ImportFromPythonModal({ onClose }: ImportFromPythonModalProps) {
  const [source, setSource] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setPipelineFromImport = useCanvasStore((s) => s.setPipelineFromImport);
  const setBaselineFromImport = useCanvasStore((s) => s.setBaselineFromImport);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleImport = useCallback(async () => {
    if (!source.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { pipeline } = await importPipelineFromPython(source.trim());
      const trimmed = source.trim();
      setPipelineFromImport(pipeline);
      setBaselineFromImport(trimmed, 'python');
      onClose();
    } catch (err) {
      console.error('Import from Python failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to import pipeline from Python.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [source, setPipelineFromImport, setBaselineFromImport, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleImport();
      }
    },
    [handleImport]
  );

  return (
    <div
      className={modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn(modalPanel, 'w-full max-w-lg p-6')}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <FileCode className="text-emerald-600" size={18} />
            </div>
            <div>
              <h2 className={headingBase}>Import from Python</h2>
              <p className={caption}>
                Paste a pandas script to generate pipeline nodes
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

        <textarea
          ref={textareaRef}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste your Python/pandas script here..."
          className={cn(input.default, 'mb-3 h-40 resize-y font-mono text-sm')}
          disabled={isLoading}
        />

        <div className="mb-3">
          <button
            type="button"
            onClick={() => {
              setSource(EXAMPLE_SNIPPET);
              setError(null);
            }}
            disabled={isLoading}
            className="text-xs text-gray-500 underline transition-colors hover:text-emerald-600"
          >
            Insert example script
          </button>
        </div>

        {error && (
          <div className={cn(alert, 'mb-3 flex items-start gap-2')}>
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to import
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
              onClick={handleImport}
              disabled={!source.trim() || isLoading}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className={cn(spinner, 'border-white/30 border-t-white')} />
                  Importing...
                </>
              ) : (
                <>
                  Import
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
