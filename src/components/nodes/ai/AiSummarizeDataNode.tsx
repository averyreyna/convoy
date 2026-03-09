import { useState, useCallback, useMemo } from 'react';
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

/** Get the first confirmed data source node's output (fallback when nothing is connected). */
function useFirstDataSourceOutput() {
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeOutputs = useDataStore((s) => s.nodeOutputs);

  return useMemo(() => {
    const dataSourceNode = nodes.find(
      (n) => n.type === 'dataSource' && (n.data as { state?: string })?.state === 'confirmed'
    );
    if (!dataSourceNode) return undefined;
    return nodeOutputs[dataSourceNode.id];
  }, [nodes, nodeOutputs]);
}

export function AiSummarizeDataNode({ id, data, selected }: AiSummarizeDataNodeProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useNodeUpdate<AiSummarizeDataNodeData>(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = data.prompt ?? '';
  const nodeState: NodeState = data.state ?? 'confirmed';

  const upstreamData = useUpstreamData(id);
  const fallbackData = useFirstDataSourceOutput();
  /** Use connected node's output if present, otherwise first data source in the pipeline. */
  const pipelineData = upstreamData?.columns?.length ? upstreamData : fallbackData;

  const setPrompt = useCallback(
    (value: string) => {
      updateNode({ prompt: value, error: undefined });
      setError(null);
    },
    [updateNode]
  );

  const hasData = Boolean(pipelineData && pipelineData.columns?.length);
  const canSummarize = hasData;

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

      const sourceNode = nodes.find((n) => n.id === id);
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
      setError(err instanceof Error ? err.message : 'Summarize failed. Please try again.');
      updateNode({
        error: err instanceof Error ? err.message : 'Summarize failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [canSummarize, pipelineData, prompt, id, nodes, addNode, updateNode]);

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
        {!hasData && (
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
