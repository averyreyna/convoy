import { useCallback, useRef, useState } from 'react';
import { X, Download, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChartImage } from '@/hooks/useChartImage';
import { renderChart } from '@/lib/api';
import type { Column } from '@/types';
import {
  modalOverlay,
  modalPanel,
  modalHeader,
  headingLg,
  caption,
  button,
} from '@/flank';

interface ChartPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartType: string;
  xAxis: string;
  yAxis: string;
  colorBy?: string;
  data: Record<string, unknown>[];
  columns: Column[];
}

export function ChartPreviewModal({
  isOpen,
  onClose,
  chartType,
  xAxis,
  yAxis,
  colorBy,
  data,
}: ChartPreviewModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingSvg, setIsExportingSvg] = useState(false);

  const { image, isLoading, error } = useChartImage({
    chartType,
    xAxis,
    yAxis,
    colorBy,
    data,
    width: 800,
    height: 500,
    format: 'png',
  });

  const handleExportPNG = useCallback(() => {
    if (!image || !image.startsWith('data:image/png')) return;
    const link = document.createElement('a');
    link.download = `chart-${chartType}-${Date.now()}.png`;
    link.href = image;
    link.click();
  }, [chartType, image]);

  const handleExportSVG = useCallback(async () => {
    if (!xAxis || !yAxis || data.length === 0) return;
    setIsExportingSvg(true);
    try {
      const { image: svgImage } = await renderChart({
        chartType,
        xAxis,
        yAxis,
        colorBy,
        data,
        width: 800,
        height: 500,
        format: 'svg',
      });
      const blob = new Blob([svgImage], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `chart-${chartType}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingSvg(false);
    }
  }, [chartType, xAxis, yAxis, colorBy, data]);

  if (!isOpen) return null;

  const hasData = xAxis && yAxis && data.length > 0;

  return (
    <div
      className={cn(modalOverlay, 'fixed z-[9999]')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal
      tabIndex={-1}
    >
      <div className={cn(modalPanel, 'h-[80vh] w-[85vw]')}>
        <div className={cn(modalHeader, 'px-6')}>
          <div>
            <h2 className={headingLg}>Chart Preview</h2>
            <p className={caption}>
              {chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart
              &mdash; {yAxis} by {xAxis}
              {data.length > 0 && ` (${data.length} data points)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={!image || !image.startsWith('data:image/png')}
              className={cn(button.base, button.variants.secondary, button.sizes.md)}
              title="Export as PNG"
            >
              <Image size={14} />
              PNG
            </button>
            <button
              type="button"
              onClick={() => handleExportSVG()}
              disabled={!hasData || isExportingSvg}
              className={cn(button.base, button.variants.secondary, button.sizes.md)}
              title="Export as SVG"
            >
              <Download size={14} />
              {isExportingSvg ? '…' : 'SVG'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn(button.base, button.variants.ghost, button.sizes.md)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartContainerRef} className="h-[calc(100%-72px)] p-6">
          {hasData ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              {isLoading && (
                <div className="flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                </div>
              )}
              {error && (
                <div className="max-w-md p-4 text-center text-sm text-amber-700">
                  <p className="font-medium">Chart preview unavailable</p>
                  <p className="mt-1 text-xs">
                    Ensure the server is running with Python and matplotlib.
                  </p>
                </div>
              )}
              {image && !error && (
                <img
                  src={
                    image.startsWith('data:')
                      ? image
                      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image)}`
                  }
                  alt="Chart"
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              No data to display
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
