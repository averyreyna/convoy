import { useState, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Brush } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { cleanDataWithAi } from '@/lib/api';
import type { EditNodesSchema } from '@/types';
import { BaseNode } from '../core/BaseNode';
import type { AiCleanDataNodeData, NodeState } from '@/types';
import { input, caption, mutedBox, mutedBoxRow } from '@/flank';
import { useNodeUpdate } from '../hooks';
import { useAiCleanDataExecution } from '@/hooks/useAiCleanDataExecution';
import { AiCallButton } from './AiCallButton';
import { AiErrorAlert } from './AiErrorAlert';
import { DataPreview } from '../core/DataPreview';
import { NodeCodePreview } from '../core/NodeCodePreview';

type AiCleanDataNodeProps = NodeProps & {
  data: AiCleanDataNodeData;
};

export function AiCleanDataNode({ id, data, selected }: AiCleanDataNodeProps) {
  const confirmNode = useCanvasStore((s) => s.confirmNode);
  const [loading, setLoading] = useState(false);

  const instruction = data.instruction ?? '';
  const nodeState: NodeState = data.state ?? 'proposed';

  const updateNode = useNodeUpdate<AiCleanDataNodeData>(id);
  const { upstreamData } = useAiCleanDataExecution(id, data.generatedCode, data.state === 'confirmed');
  const nodeOutput = useDataStore((s) => s.nodeOutputs[id]);

  const setInstruction = useCallback(
    (value: string) => {
      updateNode({ instruction: value });
      updateNode({ error: undefined });
    },
    [updateNode]
  );

  const canClean =
    instruction.trim().length > 0 &&
    upstreamData &&
    upstreamData.rows.length > 0 &&
    upstreamData.columns?.length > 0;

  const handleCleanOrRegenerate = useCallback(async () => {
    if (!canClean || !upstreamData) return;
    setLoading(true);
    updateNode({ error: undefined });
    try {
      const schema: EditNodesSchema = {
        columns: upstreamData.columns.map((c) => ({ name: c.name, type: c.type })),
      };
      const sampleRows = upstreamData.rows.slice(0, 10) as Record<string, unknown>[];
      const { code } = await cleanDataWithAi({
        instruction: instruction.trim(),
        schema,
        sampleRows,
      });
      updateNode({ generatedCode: code });
      // hook will run the code when generatedCode updates
    } catch (err) {
      console.error('Clean data failed:', err);
      updateNode({
        error: err instanceof Error ? err.message : 'Clean failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [canClean, upstreamData, instruction, updateNode]);

  const hasCode = Boolean(data.generatedCode?.trim());
  const hasUpstream = Boolean(upstreamData);

  return (
    <BaseNode
      nodeId={id}
      state={nodeState}
      title="Clean data with AI"
      icon={<Brush size={16} />}
      selected={selected}
      inputs={1}
      outputs={1}
      onConfirm={() => confirmNode(id)}
      inputRowCount={data.inputRowCount}
      outputRowCount={data.outputRowCount}
      errorMessage={data.error}
    >
      <div className="space-y-3">
        {!hasUpstream && (
          <p className={cn(caption, 'text-amber-600')}>
            Connect a data source to clean.
          </p>
        )}
        <div>
          <label className="sr-only">Cleaning instruction</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Remove rows where status is empty or duplicate IDs"
            className={cn(input.default, 'min-h-[72px] resize-y text-sm')}
            disabled={loading}
          />
        </div>
        <AiCallButton
          label={hasCode ? 'Regenerate' : 'Clean'}
          loadingLabel={hasCode ? 'Regenerating' : 'Cleaning'}
          loading={loading}
          disabled={!canClean}
          onClick={handleCleanOrRegenerate}
          className="w-full"
        />

        {data.error && <AiErrorAlert message={data.error} />}

        {data.inputRowCount !== undefined && (
          <div className={cn(mutedBox, mutedBoxRow, caption)}>
            <span>{data.inputRowCount.toLocaleString()} rows in</span>
            <span className="text-gray-300">→</span>
            <span className="font-medium text-gray-700">
              {data.outputRowCount?.toLocaleString() ?? '?'} rows out
            </span>
          </div>
        )}

        {hasCode && (
          <NodeCodePreview
            type="aiCleanData"
            config={{}}
            customCode={data.generatedCode}
            title="Generated code"
          />
        )}

        <DataPreview data={nodeOutput} />
      </div>
    </BaseNode>
  );
}
