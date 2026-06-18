import { useState, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { summarizeDataWithAi } from '@/lib/api';
import type { EditNodesSchema } from '@/types';
import { BaseNode } from '../core/BaseNode';
import type { AiSummarizeDataNodeData, NodeState } from '@/types';
import { input, caption } from '@/flank';
import { useNodeUpdate } from '../hooks';
import { useUpstreamData } from '@/hooks/useUpstreamData';
import { AiCallButton } from './AiCallButton';
import { AiErrorAlert } from './AiErrorAlert';

const NOTE_OFFSET_X = 320;
const SOURCE_LABEL = 'Summarize data';

type AiSummarizeDataNodeProps = NodeProps & {
  data: AiSummarizeDataNodeData;
};

function useFirstDataSourceOutput() {
  // Select the id of the first confirmed data source (a primitive), then its
  // output by id — so this only re-renders when that id or its output changes,
  // not on every node mutation or any other node's output update.
  const dataSourceId = useCanvasStore((s) =>
    s.nodes.find(
      (n) => n.type === 'dataSource' && (n.data as { state?: string })?.state === 'confirmed'
    )?.id
  );
  return useDataStore((s) => (dataSourceId != null ? s.nodeOutputs[dataSourceId] : undefined));
}

export function AiSummarizeDataNode({ id, data, selected }: AiSummarizeDataNodeProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNode = useNodeUpdate<AiSummarizeDataNodeData>(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = data.prompt ?? '';
  const nodeState: NodeState = data.state ?? 'confirmed';

  const upstreamData = useUpstreamData(id);
  const fallbackData = useFirstDataSourceOutput();
  // use connected node's output if present, otherwise first data source in the pipeline
  const pipelineData = upstreamData?.columns?.length ? upstreamData : fallbackData;

  const setPrompt = useCallback(
    (value: string) => {
      updateNode({ prompt: value, error: undefined });
      setError(null);
    },
    [updateNode]
  );

  const canSummarize = Boolean(pipelineData && pipelineData.columns?.length);

  const handleSummarize = useCallback(async () => {
    if (!canSummarize || !pipelineData) return;
    setLoading(true);
    setError(null);
    updateNode({ error: undefined });
    try {
      const schema: EditNodesSchema = {
        columns: pipelineData.columns.map((c) => ({ name: c.name, type: c.type })),
      };
      const sampleRows = pipelineData.rows.slice(0, 10) as Record<string, unknown>[];
      const { summary, title } = await summarizeDataWithAi({
        schema,
        sampleRows,
        prompt: prompt.trim() || undefined,
      });

      const sourceNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
      const position = sourceNode?.position
        ? { x: sourceNode.position.x + NOTE_OFFSET_X, y: sourceNode.position.y }
        : { x: 120, y: 120 };

      addNode({
        id: `canvas-note-${Date.now()}`,
        type: 'canvasNote',
        position,
        data: {
          state: 'confirmed',
          label: 'Note',
          content: summary,
          title: title || undefined,
          sourceNodeId: id,
          sourceLabel: SOURCE_LABEL,
          noteKind: 'summary',
        },
      });
    } catch (err) {
      console.error('Summarize data failed:', err);
      const message = err instanceof Error ? err.message : 'Summarize failed. Please try again.';
      setError(message);
      updateNode({ error: message });
    } finally {
      setLoading(false);
    }
  }, [canSummarize, pipelineData, prompt, id, addNode, updateNode]);

  return (
    <BaseNode
      nodeId={id}
      state={nodeState}
      title="Summarize data"
      icon={<FileText size={16} />}
      selected={selected}
      inputs={1}
      outputs={0}
      wide
      errorMessage={data.error}
    >
      <div className="space-y-3">
        {!canSummarize && (
          <p className={cn(caption, 'text-amber-600')}>
            Connect a node (e.g. Data Source or any node with output) to summarize, or load a data source and run the pipeline.
          </p>
        )}
        <div className="space-y-1">
          <label className={cn(caption, 'block text-gray-600')}>
            Optional: focus your summary
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., date range, missing values, or what to emphasize"
            className={cn(input.default, 'min-h-[60px] resize-y text-sm')}
            disabled={loading}
          />
        </div>
        <AiCallButton
          label="Summarize"
          loadingLabel="Summarizing"
          loading={loading}
          disabled={!canSummarize}
          onClick={handleSummarize}
          className="w-full"
        />

        {error && <AiErrorAlert message={error} />}
      </div>
    </BaseNode>
  );
}
