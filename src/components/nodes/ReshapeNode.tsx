import { useMemo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FlipVertical2, Check } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
import { cn } from '@/lib/utils';
import { label, input, alertWarning, caption, mutedBox, dropZoneDefault } from '@/design-system';
import type { ReshapeNodeData } from '@/types';

type ReshapeNodeProps = NodeProps & {
  data: ReshapeNodeData;
};

export function ReshapeNode({ id, data, selected }: ReshapeNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  const selectedPivotColumns = data.pivotColumns ?? [];

  // Build config object for the executor
  const config = useMemo(
    () => ({
      keyColumn: data.keyColumn,
      valueColumn: data.valueColumn,
      pivotColumns: selectedPivotColumns,
    }),
    [data.keyColumn, data.valueColumn, selectedPivotColumns]
  );

  // Execute the node and get upstream data for column list
  const { upstreamData } = useNodeExecution(
    id,
    'reshape',
    config,
    data.state === 'confirmed',
    data.customCode
  );

  const columns = upstreamData?.columns ?? [];
  const nodeOutput = useDataStore((s) => s.nodeOutputs[id]);

  const togglePivotColumn = useCallback(
    (colName: string) => {
      const current = data.pivotColumns ?? [];
      const updated = current.includes(colName)
        ? current.filter((c) => c !== colName)
        : [...current, colName];
      updateNode(id, { pivotColumns: updated });
    },
    [id, data.pivotColumns, updateNode]
  );

  return (
    <BaseNode
      nodeId={id}
      state={data.state}
      title="Reshape"
      icon={<FlipVertical2 size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="reshape"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      customCode={data.customCode}
      errorMessage={data.error}
    >
      <div className="space-y-2">
        {/* Key column name (the new column that holds the original column names) */}
        <div>
          <label className={label}>Key column name</label>
          <input
            type="text"
            value={data.keyColumn || ''}
            onChange={(e) => updateNode(id, { keyColumn: e.target.value })}
            placeholder='e.g. "year"'
            className={input.default}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Value column name */}
        <div>
          <label className={label}>Value column name</label>
          <input
            type="text"
            value={data.valueColumn || ''}
            onChange={(e) => updateNode(id, { valueColumn: e.target.value })}
            placeholder='e.g. "value"'
            className={input.default}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Pivot columns selector */}
        <div>
          <label className={label}>Columns to unpivot</label>
          {columns.length > 0 ? (
            <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-1.5">
              {columns.map((col) => {
                const isSelected = selectedPivotColumns.includes(col.name);
                return (
                  <button
                    key={col.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePivotColumn(col.name);
                    }}
                    className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[10px] transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check size={8} className="text-white" />}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {col.name}
                    </span>
                    <span className="flex-shrink-0 text-[9px] text-gray-400">
                      {col.type}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={cn(dropZoneDefault, 'text-center text-xs text-gray-400')}>
              No columns available
            </div>
          )}
        </div>

        {/* Summary */}
        {selectedPivotColumns.length > 0 && (
          <div className={cn(mutedBox, caption)}>
            Unpivoting {selectedPivotColumns.length} columns into{' '}
            <span className="font-medium">{data.keyColumn || '?'}</span> /{' '}
            <span className="font-medium">{data.valueColumn || '?'}</span>
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
