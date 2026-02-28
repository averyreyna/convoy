import { useState, useEffect, useRef } from 'react';
import { renderChart } from '@/lib/api';

export interface UseChartImageParams {
  chartType: string;
  xAxis: string;
  yAxis: string;
  colorBy?: string;
  data: Record<string, unknown>[];
  width?: number;
  height?: number;
  format?: 'png' | 'svg';
}

const DEBOUNCE_MS = 350;

/**
 * Fetches a backend-rendered chart image (matplotlib). Debounces requests
 * so changing axes/config doesn't trigger a request per keystroke.
 */
export function useChartImage(params: UseChartImageParams): {
  image: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const {
    chartType,
    xAxis,
    yAxis,
    colorBy,
    data,
    width,
    height,
    format = 'png',
  } = params;

  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);

  const hasInput = Boolean(xAxis && yAxis && data.length > 0);

  useEffect(() => {
    if (!hasInput) {
      setImage(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const fetchId = ++fetchIdRef.current;
    const timeoutId = window.setTimeout(() => {
      renderChart({
        chartType,
        xAxis,
        yAxis,
        colorBy,
        data,
        width,
        height,
        format,
      })
        .then((res) => {
          if (fetchId === fetchIdRef.current) {
            setImage(res.image);
            setError(null);
          }
        })
        .catch((err) => {
          if (fetchId === fetchIdRef.current) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setImage(null);
          }
        })
        .finally(() => {
          if (fetchId === fetchIdRef.current) {
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasInput, chartType, xAxis, yAxis, colorBy, data, width, height, format]);

  return { image, isLoading, error };
}
