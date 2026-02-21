import { useCallback, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Code2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';
import { DataPreview } from './DataPreview';
import type { BaseNodeData } from '@/types';

interface TransformNodeData extends BaseNodeData {
  customCode?: string;
  isCodeMode?: boolean;
  inputRowCount?: number;
  outputRowCount?: number;
}

type TransformNodeProps = NodeProps & {
  data: TransformNodeData;
};

const DEFAULT_TRANSFORM_CODE = `// The input data is available as 'rows' (array of objects)
// and 'columns' (array of {name, type}).
// Return { columns, rows } with your transformed data.

// Example: add a calculated column
// const newCols = [...columns, { name: "newCol", type: "number" }];
// const newRows = rows.map(row => ({ ...row, newCol: Number(row.colA) + Number(row.colB) }));
// return { columns: newCols, rows: newRows };

return { columns, rows };`;

export function TransformNode({ id, data, selected }: TransformNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const updateNode = useCanvasStore((s) => s.updateNode);

  const code = data.customCode || DEFAULT_TRANSFORM_CODE;

  // Config used for execution
  const config = useMemo(
    () => ({
      customCode: code,
    }),
    [code]
  );

  // Execute the node
  const { upstreamData } = useNodeExecution(
    id,
    'transform',
    config,
    data.state === 'confirmed'
  );

  const nodeOutput = useDataStore((s) => s.nodeOutputs[id]);

  // Code view handlers
  const handleToggleCodeMode = useCallback(() => {
    // Transform is always in code mode — no-op
  }, []);

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
      title="Transform"
      icon={<Code2 size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      nodeType="transform"
      nodeConfig={config}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      isCodeMode={true}
      customCode={code}
      onToggleCodeMode={handleToggleCodeMode}
      onCodeChange={handleCodeChange}
      codeOnly
      executionError={data.error}
      upstreamColumns={(upstreamData?.columns ?? []).map((c) => c.name)}
    >
      {/* Children not shown for code-only nodes */}
      <div className="space-y-1">
        {data.inputRowCount !== undefined && (
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1 text-[10px] text-gray-500">
            <span>{data.inputRowCount.toLocaleString()} rows in</span>
            <span className="text-gray-300">&rarr;</span>
            <span className="font-medium text-gray-700">
              {data.outputRowCount?.toLocaleString() ?? '?'} rows out
            </span>
          </div>
        )}
        {!upstreamData && data.state === 'confirmed' && (
          <div className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-600">
            Connect a data source to process data
          </div>
        )}
        {data.error && (
          <div className="rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-600">
            {data.error}
          </div>
        )}

        {/* Output data preview */}
        <DataPreview data={nodeOutput} />
      </div>
    </BaseNode>
  );
}
