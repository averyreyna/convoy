import { useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaseNode } from '../core/BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from '../core/DataPreview';
import { label, input, alertWarning, captionMuted } from '@/flank';
import type { ComputedColumnNodeData } from '@/types';

type ComputedColumnNodeProps = NodeProps & {
  data: ComputedColumnNodeData;
};

export function ComputedColumnNode({ id, data, selected }: ComputedColumnNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Build config object for the executor
  const config = useMemo(
    () => ({
      newColumnName: data.newColumnName,
      expression: data.expression,
    }),
    [data.newColumnName, data.expression]
  );

  // Execute the node and get upstream data for column references
  const { upstreamData } = useNodeExecution(
    id,
    'computedColumn',
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
      title="Computed Column"
      icon={<Calculator size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="computedColumn"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      customCode={data.customCode}
      errorMessage={data.error}
    >
      <div className="space-y-2">
        {/* New column name */}
        <div>
          <label className={label}>Column name</label>
          <input
            type="text"
            value={data.newColumnName || ''}
            onChange={(e) => updateNode(id, { newColumnName: e.target.value })}
            placeholder="e.g. density"
            className={input.default}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Expression */}
        <div>
          <label className={label}>Expression</label>
          <input
            type="text"
            value={data.expression || ''}
            onChange={(e) => updateNode(id, { expression: e.target.value })}
            placeholder="e.g. d.population / d.area"
            className={cn(input.default, 'font-mono')}
            onClick={(e) => e.stopPropagation()}
          />
          <div className={cn('mt-1', captionMuted)}>
            Use <code className="rounded bg-gray-100 px-0.5">d.column_name</code> to reference columns
          </div>
        </div>

        {/* Available columns hint */}
        {columns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {columns.slice(0, 6).map((col) => (
              <span
                key={col.name}
                className={cn('rounded bg-gray-100 px-1 py-0.5 font-mono', captionMuted)}
              >
                d.{col.name}
              </span>
            ))}
            {columns.length > 6 && (
              <span className={cn('rounded bg-gray-100 px-1 py-0.5', captionMuted)}>
                +{columns.length - 6} more
              </span>
            )}
          </div>
        )}

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
