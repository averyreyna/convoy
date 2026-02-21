import { useMemo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ArrowUpDown } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
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
      title="Sort"
      icon={<ArrowUpDown size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="sort"
      nodeConfig={config}
      isCodeMode={data.isCodeMode}
      customCode={data.customCode}
      onToggleCodeMode={handleToggleCodeMode}
      onCodeChange={handleCodeChange}
      executionError={data.error}
      upstreamColumns={(upstreamData?.columns ?? []).map((c) => c.name)}
    >
      <div className="space-y-2">
        {/* Column selector */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Sort by
          </label>
          <select
            value={data.column || ''}
            onChange={(e) => updateNode(id, { column: e.target.value })}
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

        {/* Direction toggle */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Direction
          </label>
          <div className="flex rounded-md border border-gray-200 p-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateNode(id, { direction: 'asc' });
              }}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                data.direction !== 'desc'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Ascending
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateNode(id, { direction: 'desc' });
              }}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                data.direction === 'desc'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Descending
            </button>
          </div>
        </div>

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
