import { useState, useCallback, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BarChart3, Maximize2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useUpstreamData } from '@/hooks/useUpstreamData';
import { cn } from '@/lib/utils';
import { label, button, input, caption, alertWarning } from '@/design-system';
import { ChartPreviewModal } from './ChartPreviewModal';
import { D3Chart } from '@/components/charts/D3Chart';
import type { ChartNodeData } from '@/types';

const CHART_TYPES = ['bar', 'line', 'area', 'scatter', 'pie'] as const;

type ChartNodeProps = NodeProps & {
  data: ChartNodeData;
};

export function ChartNode({ id, data, selected }: ChartNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const upstreamData = useUpstreamData(id);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const columns = upstreamData?.columns ?? [];
  const chartData = upstreamData?.rows ?? [];

  // Config object for the AI explanation
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
          {/* Row 1: chart type buttons + axis dropdowns */}
          <div className="flex items-end gap-2">
            {/* Chart type selector */}
            <div className="shrink-0">
              <label className={label}>Chart type</label>
              <div className="flex gap-0.5">
                {CHART_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNode(id, { chartType: type });
                    }}
                    className={cn(
                      button.base,
                      button.sizes.sm,
                      data.chartType === type
                        ? button.variants.primary
                        : button.variants.secondary
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* X Axis */}
            <div className="min-w-0 flex-1">
              <label className={label}>X Axis</label>
              <select
                value={data.xAxis || ''}
                onChange={(e) =>
                  updateNode(id, { xAxis: e.target.value })
                }
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

            {/* Y Axis */}
            <div className="min-w-0 flex-1">
              <label className={label}>Y Axis</label>
              <select
                value={data.yAxis || ''}
                onChange={(e) =>
                  updateNode(id, { yAxis: e.target.value })
                }
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

            {/* Color-by column */}
            <div className="min-w-0 flex-1">
              <label className={label}>Color by</label>
              <select
                value={data.colorBy || ''}
                onChange={(e) =>
                  updateNode(id, {
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

          {/* Inline chart */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border border-gray-100 bg-white',
              hasChart && 'cursor-pointer hover:border-blue-200'
            )}
            onDoubleClick={handleOpenPreview}
          >
            {hasChart ? (
              <D3Chart
                chartType={data.chartType || 'bar'}
                data={previewData}
                xAxis={data.xAxis!}
                yAxis={data.yAxis!}
                colorBy={data.colorBy}
                height={280}
              />
            ) : (
              <div className="flex h-[280px] flex-col items-center justify-center text-gray-300">
                <BarChart3 size={32} />
                <span className={cn('mt-2', caption)}>Configure chart axes to preview</span>
              </div>
            )}

            {/* Expand button for full-screen / export */}
            {hasChart && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPreview();
                }}
                className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-gray-400 shadow-sm ring-1 ring-gray-200 transition-all hover:text-gray-600 hover:shadow group-hover:opacity-100"
                title="Full-screen preview &amp; export"
              >
                <Maximize2 size={14} />
              </button>
            )}

            {/* Data summary inside chart container */}
            {hasChart && (
              <div className={cn('border-t border-gray-50 py-1 text-center', caption)}>
                {chartData.length.toLocaleString()} data points
              </div>
            )}
          </div>

          {/* No upstream data warning */}
          {!upstreamData && data.state === 'confirmed' && (
            <div className={cn(alertWarning, '!mb-0')}>
              Connect a data source to populate columns
            </div>
          )}
        </div>
      </BaseNode>

      {/* Full-screen preview modal (for export) */}
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
