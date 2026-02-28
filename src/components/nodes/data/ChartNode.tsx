import { useState, useCallback, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BarChart3, Maximize2 } from 'lucide-react';
import { BaseNode } from '../core/BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useUpstreamData } from '@/hooks/useUpstreamData';
import { cn } from '@/lib/utils';
import { label, button, input, caption, alertWarning } from '@/flank';
import { ChartPreviewModal } from '../core/ChartPreviewModal';
import { useChartImage } from '@/hooks/useChartImage';
import type { ChartNodeData } from '@/types';

const CHART_TYPES = ['bar', 'line', 'area', 'scatter', 'pie'] as const;

type ChartNodeProps = NodeProps & {
  data: ChartNodeData;
};

interface ChartConfigPanelProps {
  data: ChartNodeData;
  columns: { name: string }[];
  onUpdateConfig: (partial: Partial<ChartNodeData>) => void;
}

interface ChartPreviewAreaProps {
  data: ChartNodeData;
  chartData: Record<string, unknown>[];
  previewData: Record<string, unknown>[];
  hasChart: boolean;
  onOpenPreview: () => void;
}

function ChartConfigPanel({ data, columns, onUpdateConfig }: ChartConfigPanelProps) {
  return (
    <div className="flex items-end gap-2">
      <div className="shrink-0">
        <label className={label}>Chart type</label>
        <div className="flex gap-0.5">
          {CHART_TYPES.map((type) => (
            <button
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateConfig({ chartType: type });
              }}
              className={cn(
                button.base,
                button.sizes.sm,
                data.chartType === type ? button.variants.primary : button.variants.secondary
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <label className={label}>X Axis</label>
        <select
          value={data.xAxis || ''}
          onChange={(e) => onUpdateConfig({ xAxis: e.target.value })}
          className={input.default}
        >
          <option value="">Select...</option>
          {columns.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 flex-1">
        <label className={label}>Y Axis</label>
        <select
          value={data.yAxis || ''}
          onChange={(e) => onUpdateConfig({ yAxis: e.target.value })}
          className={input.default}
        >
          <option value="">Select...</option>
          {columns.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 flex-1">
        <label className={label}>Color by</label>
        <select
          value={data.colorBy || ''}
          onChange={(e) =>
            onUpdateConfig({
              colorBy: e.target.value || undefined,
            })
          }
          className={input.default}
        >
          <option value="">None</option>
          {columns.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ChartPreviewArea({
  data,
  chartData,
  previewData,
  hasChart,
  onOpenPreview,
}: ChartPreviewAreaProps) {
  const { image, isLoading, error } = useChartImage({
    chartType: data.chartType || 'bar',
    xAxis: data.xAxis || '',
    yAxis: data.yAxis || '',
    colorBy: data.colorBy,
    data: previewData,
    width: 640,
    height: 280,
  });

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-gray-100 bg-white',
        hasChart && 'cursor-pointer hover:border-blue-200'
      )}
      onDoubleClick={onOpenPreview}
    >
      {hasChart ? (
        <div className="relative h-[280px] w-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
            </div>
          )}
          {error && (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-amber-700">
              <p className="font-medium">Chart preview unavailable</p>
              <p className="mt-1 text-xs">Ensure the server is running with Python and matplotlib.</p>
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
              className="h-full w-full object-contain"
            />
          )}
        </div>
      ) : (
        <div className="flex h-[280px] flex-col items-center justify-center text-gray-300">
          <BarChart3 size={32} />
          <span className={cn('mt-2', caption)}>Configure chart axes to preview</span>
        </div>
      )}

      {hasChart && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview();
            }}
            className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-gray-400 shadow-sm ring-1 ring-gray-200 transition-all hover:text-gray-600 hover:shadow group-hover:opacity-100"
            title="Full-screen preview &amp; export"
          >
            <Maximize2 size={14} />
          </button>
          <div className={cn('border-t border-gray-50 py-1 text-center', caption)}>
            {chartData.length.toLocaleString()} data points
          </div>
        </>
      )}
    </div>
  );
}

export function ChartNode({ id, data, selected }: ChartNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const upstreamData = useUpstreamData(id);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const columns = upstreamData?.columns ?? [];
  const chartData = upstreamData?.rows ?? [];

  const explanationConfig = useMemo(
    () => ({
      chartType: data.chartType,
      xAxis: data.xAxis,
      yAxis: data.yAxis,
      colorBy: data.colorBy,
    }),
    [data.chartType, data.xAxis, data.yAxis, data.colorBy]
  );

  const handleOpenPreview = useCallback(() => {
    if (data.xAxis && data.yAxis && chartData.length > 0) {
      setIsPreviewOpen(true);
    }
  }, [data.xAxis, data.yAxis, chartData.length]);

  const hasChart = data.xAxis && data.yAxis && chartData.length > 0;
  const previewData = useMemo(() => chartData.slice(0, 100), [chartData]);

  return (
    <>
      <BaseNode
        nodeId={id}
        state={data.state}
        title="Chart"
        icon={<BarChart3 size={16} />}
        selected={selected}
        inputs={1}
        outputs={0}
        onConfirm={() => confirmNode(id)}
        nodeType="chart"
        nodeConfig={explanationConfig}
        customCode={data.customCode}
        errorMessage={data.error}
        wide
      >
        <div className="space-y-2">
          <ChartConfigPanel
            data={data}
            columns={columns}
            onUpdateConfig={(partial) => updateNode(id, partial)}
          />
          <ChartPreviewArea
            data={data}
            chartData={chartData}
            previewData={previewData}
            hasChart={!!hasChart}
            onOpenPreview={handleOpenPreview}
          />
          {!upstreamData && data.state === 'confirmed' && (
            <div className={cn(alertWarning, '!mb-0')}>
              Connect a data source to populate columns
            </div>
          )}
        </div>
      </BaseNode>

      <ChartPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        chartType={data.chartType || 'bar'}
        xAxis={data.xAxis || ''}
        yAxis={data.yAxis || ''}
        colorBy={data.colorBy}
        data={chartData}
        columns={columns}
      />
    </>
  );
}
