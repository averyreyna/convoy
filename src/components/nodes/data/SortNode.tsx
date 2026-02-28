import { useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaseNode } from '../core/BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from '../core/DataPreview';
import { label, input, button, alertWarning, segmentControl, segmentControlItem, segmentControlItemSelected } from '@/flank';
import type { SortNodeData } from '@/types';

type SortNodeProps = NodeProps & {
  data: SortNodeData;
};

export function SortNode({ id, data, selected }: SortNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Build config object for the executor
  const config = useMemo(
    () => ({
      column: data.column,
      direction: data.direction || 'asc',
    }),
    [data.column, data.direction]
  );

  // Execute the node and get upstream data for column dropdown
  const { upstreamData } = useNodeExecution(
    id,
    'sort',
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
      title="Sort"
      icon={<ArrowUpDown size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="sort"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      customCode={data.customCode}
      errorMessage={data.error}
    >
      <div className="space-y-2">
        {/* Column selector */}
        <div>
          <label className={label}>Sort by</label>
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

        {/* Direction toggle */}
        <div>
          <label className={label}>Direction</label>
          <div className={segmentControl}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateNode(id, { direction: 'asc' });
              }}
              className={cn(segmentControlItem, 'flex-1', data.direction !== 'desc' && segmentControlItemSelected)}
            >
              Ascending
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateNode(id, { direction: 'desc' });
              }}
              className={cn(segmentControlItem, 'flex-1', data.direction === 'desc' && segmentControlItemSelected)}
            >
              Descending
            </button>
          </div>
        </div>

        {/* Output data preview */}
        <DataPreview data={nodeOutput} />

        {/* No upstream data warning */}
        {!upstreamData && data.state === 'confirmed' && (
          <div className={cn(alertWarning, '!mb-0')}>
            Connect a data source to populate columns
          </div>
        )}
      </div>
    </BaseNode>
  );
}
