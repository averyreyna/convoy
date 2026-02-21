import { useState, useCallback, useEffect, useRef } from 'react';
import { BarChart3, ArrowRight, X, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { importPipelineFromD3 } from '@/lib/api';

// Matches sample dataset: public/data/gapminder.csv (country, gdpPerCapita, lifeExpectancy, etc.)
const EXAMPLE_SNIPPET = `const data = await d3.csv("gapminder.csv", d3.autoType);
const x = d3.scaleBand()
  .domain(data.map(d => d["country"]))
  .range([0, width])
  .padding(0.2);
const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => +d["gdpPerCapita"])])
  .range([height, 0]);
svg.selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", d => x(d["country"]))
  .attr("y", d => y(+d["gdpPerCapita"]))
  .attr("height", d => height - y(+d["gdpPerCapita"]));`;

interface ImportFromD3ModalProps {
  onClose: () => void;
}

export function ImportFromD3Modal({ onClose }: ImportFromD3ModalProps) {
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
      const { pipeline } = await importPipelineFromD3(source.trim());
      const trimmed = source.trim();
      setPipelineFromImport(pipeline);
      setBaselineFromImport(trimmed, 'javascript');
      onClose();
    } catch (err) {
      console.error('Import from D3 failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to import pipeline from D3.'
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
      className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <BarChart3 className="text-amber-600" size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Import from D3
              </h2>
              <p className="text-xs text-gray-500">
                Paste a D3.js script to generate a visualization pipeline
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

        <textarea
          ref={textareaRef}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste your D3.js script here..."
          className="mb-3 h-40 w-full resize-y rounded-lg border border-gray-200 p-3 font-mono text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
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
            className="text-xs text-gray-500 underline transition-colors hover:text-amber-600"
          >
            Insert example script
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to import
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
              onClick={handleImport}
              disabled={!source.trim() || isLoading}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 active:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
