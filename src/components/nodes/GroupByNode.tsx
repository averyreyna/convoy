import { useMemo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
import type { GroupByNodeData } from '@/types';

const AGGREGATIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

type GroupByNodeProps = NodeProps & {
  data: GroupByNodeData;
};

export function GroupByNode({ id, data, selected }: GroupByNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Build config object for the executor
  const config = useMemo(
    () => ({
      groupByColumn: data.groupByColumn,
      aggregateColumn: data.aggregateColumn,
      aggregation: data.aggregation,
    }),
    [data.groupByColumn, data.aggregateColumn, data.aggregation]
  );

  // Execute the node and get upstream data for column dropdowns
  const { upstreamData } = useNodeExecution(
    id,
    'groupBy',
    config,
    data.state === 'confirmed',
    data.customCode
  );

  const columns = upstreamData?.columns ?? [];

  const nodeOutput = useDataStore((s) => s.nodeOutputs[id]);

  // Aggregate column should only show numeric columns for sum/avg/min/max
  const needsNumericColumn =
    data.aggregation && data.aggregation !== 'count';
  const aggregateColumns = needsNumericColumn
    ? columns.filter((c) => c.type === 'number')
    : columns;

  // Code view handlers
  const handleToggleCodeMode = useCallback(() => {
    updateNode(id, { isCodeMode: !data.isCodeMode });
  }, [id, data.isCodeMode, updateNode]);

  const handleCodeChange = useCallback(
    (code: string) => {
      updateNode(id, { customCode: code, isCodeMode: true });
    },
    [id, updateNode]
  );

  return (
    <BaseNode
      nodeId={id}
      state={data.state}
      title="Group By"
      icon={<Layers size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="groupBy"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      isCodeMode={data.isCodeMode}
      customCode={data.customCode}
      onToggleCodeMode={handleToggleCodeMode}
      onCodeChange={handleCodeChange}
      executionError={data.error}
      upstreamColumns={columns.map((c) => c.name)}
    >
      <div className="space-y-2">
        {/* Group by column */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Group by
          </label>
          <select
            value={data.groupByColumn || ''}
            onChange={(e) =>
              updateNode(id, { groupByColumn: e.target.value })
            }
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>

        {/* Aggregation function */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Aggregation
          </label>
          <select
            value={data.aggregation || ''}
            onChange={(e) =>
              updateNode(id, { aggregation: e.target.value })
            }
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
          >
            <option value="">Select function...</option>
            {AGGREGATIONS.map((agg) => (
              <option key={agg.value} value={agg.value}>
                {agg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Aggregate column (hidden for 'count') */}
        {data.aggregation && data.aggregation !== 'count' && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Aggregate column
            </label>
            <select
              value={data.aggregateColumn || ''}
              onChange={(e) =>
                updateNode(id, { aggregateColumn: e.target.value })
              }
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            >
              <option value="">Select column...</option>
              {aggregateColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.type})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Row count indicator */}
        {data.inputRowCount !== undefined && (
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1 text-[10px] text-gray-500">
            <span>{data.inputRowCount.toLocaleString()} rows in</span>
            <span className="text-gray-300">→</span>
            <span className="font-medium text-gray-700">
              {data.outputRowCount?.toLocaleString() ?? '?'} groups
            </span>
          </div>
        )}

        {/* Output data preview */}
        <DataPreview data={nodeOutput} />

        {/* No upstream data warning */}
        {!upstreamData && data.state === 'confirmed' && (
          <div className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-600">
            Connect a data source to populate columns
          </div>
        )}
      </div>
    </BaseNode>
  );
}
