import { useCallback, useRef } from 'react';
import { X, Download, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { D3Chart } from '@/components/charts/D3Chart';
import type { Column } from '@/types';
import {
  modalOverlay,
  modalPanel,
  modalHeader,
  headingLg,
  caption,
  button,
} from '@/design-system';

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

  const handleExportPNG = useCallback(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `chart-${chartType}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [chartType]);

  const handleExportSVG = useCallback(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `chart-${chartType}-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [chartType]);

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
              className={cn(button.base, button.variants.secondary, button.sizes.md)}
              title="Export as PNG"
            >
              <Image size={14} />
              PNG
            </button>
            <button
              type="button"
              onClick={handleExportSVG}
              className={cn(button.base, button.variants.secondary, button.sizes.md)}
              title="Export as SVG"
            >
              <Download size={14} />
              SVG
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
            <D3Chart
              chartType={chartType}
              data={data}
              xAxis={xAxis}
              yAxis={yAxis}
              colorBy={colorBy}
              responsive
            />
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
