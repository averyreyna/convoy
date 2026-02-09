import { useState, useCallback, useRef } from 'react';
import { generateExplanation } from '@/lib/api';

/**
 * Module-level cache for AI explanations.
 * Key is a stringified combination of nodeType + nodeConfig.
 * Explanations are cached forever to avoid repeat API calls.
 */
const explanationCache = new Map<string, string>();

interface UseAIExplanationOptions {
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  inputRowCount?: number;
  outputRowCount?: number;
}

/**
 * Hook for fetching AI-generated explanations of node transformations.
 * Returns explanation text, loading state, and show/hide controls.
 * Explanations are cached so repeated views of the same node don't re-fetch.
 */
export function useAIExplanation({
  nodeType,
  nodeConfig,
  inputRowCount,
  outputRowCount,
}: UseAIExplanationOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to track the current fetch to avoid race conditions
  const fetchIdRef = useRef(0);

  const cacheKey = JSON.stringify({ nodeType, nodeConfig });

  const show = useCallback(() => {
    setIsOpen(true);
    setError(null);

    // Check cache first
    const cached = explanationCache.get(cacheKey);
    if (cached) {
      setExplanation(cached);
      setIsLoading(false);
      return;
    }

    // Fetch from API
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);

    generateExplanation({
      nodeType,
      nodeConfig,
      inputRowCount,
      outputRowCount,
    })
      .then((result) => {
        // Only update if this is still the most recent fetch
        if (fetchId === fetchIdRef.current) {
          explanationCache.set(cacheKey, result);
          setExplanation(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (fetchId === fetchIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to generate explanation');
          setIsLoading(false);
        }
      });
  }, [cacheKey, nodeType, nodeConfig, inputRowCount, outputRowCount]);

  const hide = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    explanation,
    isLoading,
    isOpen,
    error,
    show,
    hide,
  };
}
