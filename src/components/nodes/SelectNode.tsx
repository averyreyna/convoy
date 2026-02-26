import { useMemo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Columns3, X, Check } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
import type { SelectNodeData } from '@/types';

type SelectNodeProps = NodeProps & {
  data: SelectNodeData;
};

export function SelectNode({ id, data, selected }: SelectNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  const selectedColumns = data.columns ?? [];

  // Build config object for the executor
  const config = useMemo(
    () => ({
      columns: selectedColumns,
    }),
    [selectedColumns]
  );

  // Execute the node and get upstream data for column list
  const { upstreamData } = useNodeExecution(
    id,
    'select',
    config,
    data.state === 'confirmed',
    data.customCode
  );

  const availableColumns = upstreamData?.columns ?? [];
  const nodeOutput = useDataStore((s) => s.nodeOutputs[id]);

  const toggleColumn = useCallback(
    (columnName: string) => {
      const current = data.columns ?? [];
      const updated = current.includes(columnName)
        ? current.filter((c) => c !== columnName)
        : [...current, columnName];
      updateNode(id, { columns: updated });
    },
    [id, data.columns, updateNode]
  );

  const selectAll = useCallback(() => {
    updateNode(id, {
      columns: availableColumns.map((c) => c.name),
    });
  }, [id, availableColumns, updateNode]);

  const selectNone = useCallback(() => {
    updateNode(id, { columns: [] });
  }, [id, updateNode]);

  return (
    <BaseNode
      nodeId={id}
      state={data.state}
      title="Select Columns"
      icon={<Columns3 size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="select"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      customCode={data.customCode}
      errorMessage={data.error}
    >
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Columns to keep
            </label>
            {availableColumns.length > 0 && (
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAll();
                  }}
                  className="text-[9px] text-blue-500 hover:text-blue-600"
                >
                  All
                </button>
                <span className="text-[9px] text-gray-300">|</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNone();
                  }}
                  className="text-[9px] text-blue-500 hover:text-blue-600"
                >
                  None
                </button>
              </div>
            )}
          </div>

          {availableColumns.length > 0 ? (
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-1.5">
              {availableColumns.map((col) => {
                const isSelected = selectedColumns.includes(col.name);
                return (
                  <button
                    key={col.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleColumn(col.name);
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
            <div className="rounded-md border-2 border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
              No columns available
            </div>
          )}
        </div>

        {/* Selected columns summary */}
        {selectedColumns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedColumns.map((col) => (
              <span
                key={col}
                className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600"
              >
                {col}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleColumn(col);
                  }}
                  className="ml-0.5 rounded-full hover:bg-blue-100"
                >
                  <X size={8} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Column count */}
        {availableColumns.length > 0 && (
          <div className="text-center text-[10px] text-gray-400">
            {selectedColumns.length} of {availableColumns.length} columns
            selected
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
