import { useMemo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Calculator } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
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
      isCodeMode={data.isCodeMode}
      customCode={data.customCode}
      onToggleCodeMode={handleToggleCodeMode}
      onCodeChange={handleCodeChange}
      executionError={data.error}
      upstreamColumns={columns.map((c) => c.name)}
    >
      <div className="space-y-2">
        {/* New column name */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Column name
          </label>
          <input
            type="text"
            value={data.newColumnName || ''}
            onChange={(e) => updateNode(id, { newColumnName: e.target.value })}
            placeholder="e.g. density"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Expression */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Expression
          </label>
          <input
            type="text"
            value={data.expression || ''}
            onChange={(e) => updateNode(id, { expression: e.target.value })}
            placeholder="e.g. d.population / d.area"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-mono text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-1 text-[9px] text-gray-400">
            Use <code className="rounded bg-gray-100 px-0.5">d.column_name</code> to reference columns
          </div>
        </div>

        {/* Available columns hint */}
        {columns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {columns.slice(0, 6).map((col) => (
              <span
                key={col.name}
                className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-mono text-gray-500"
              >
                d.{col.name}
              </span>
            ))}
            {columns.length > 6 && (
              <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-400">
                +{columns.length - 6} more
              </span>
            )}
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
