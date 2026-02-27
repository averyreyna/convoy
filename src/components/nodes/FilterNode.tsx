import { useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
import { label, input, mutedBox, mutedBoxRow, caption } from '@/design-system';
import type { FilterNodeData } from '@/types';

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
];

type FilterNodeProps = NodeProps & {
  data: FilterNodeData;
};

export function FilterNode({ id, data, selected }: FilterNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Build config object for the executor
  const config = useMemo(
    () => ({
      column: data.column,
      operator: data.operator,
      value: data.value,
    }),
    [data.column, data.operator, data.value]
  );

  // Execute the node and get upstream data for column dropdowns
  const { upstreamData } = useNodeExecution(
    id,
    'filter',
    config,
    data.state === 'confirmed',
    data.customCode
  );

  const columns = upstreamData?.columns ?? [];
  const nodeOutput = useDataStore((s) => s.nodeOutputs[id]);

  return (
    <BaseNode
      nodeId={id}
      state={data.state}
      title="Filter"
      icon={<Filter size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="filter"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      customCode={data.customCode}
      errorMessage={data.error}
    >
      <div className="space-y-2">
        {/* Column selector */}
        <div>
          <label className={label}>Column</label>
          <select
            value={data.column || ''}
            onChange={(e) => updateNode(id, { column: e.target.value })}
            className={input.default}
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>

        {/* Operator selector */}
        <div>
          <label className={label}>Condition</label>
          <select
            value={data.operator || ''}
            onChange={(e) => updateNode(id, { operator: e.target.value })}
            className={input.default}
          >
            <option value="">Select condition...</option>
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value input */}
        <div>
          <label className={label}>Value</label>
          <input
            type="text"
            value={data.value || ''}
            onChange={(e) => updateNode(id, { value: e.target.value })}
            placeholder="Enter value..."
            className={input.default}
          />
        </div>

        {/* Row count indicator */}
        {data.inputRowCount !== undefined && (
          <div className={cn(mutedBox, mutedBoxRow, caption)}>
            <span>{data.inputRowCount.toLocaleString()} rows in</span>
            <span className="text-gray-300">→</span>
            <span className="font-medium text-gray-700">
              {data.outputRowCount?.toLocaleString() ?? '?'} rows out
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
