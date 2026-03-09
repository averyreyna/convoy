import { useState, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { diagnoseNodesWithAi } from '@/lib/aiNodes';
import type { EditNodesSchema } from '@/types';
import { BaseNode } from '../core/BaseNode';
import type { AiDiagnoseNodeData, NodeState } from '@/types';
import { input, caption } from '@/flank';
import { useNodeUpdate } from '../hooks';
import { useNodeContext } from '../hooks';
import { useUpstreamData } from '@/hooks/useUpstreamData';
import { usePipelineContext } from '../hooks';
import { AiCallButton } from './AiCallButton';
import { AiErrorAlert } from './AiErrorAlert';

const NOTE_OFFSET_X = 320;
const SOURCE_LABEL = 'Debug';

type AiDiagnoseNodeProps = NodeProps & {
  data: AiDiagnoseNodeData;
};

export function AiDiagnoseNode({ id, data, selected }: AiDiagnoseNodeProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useNodeUpdate<AiDiagnoseNodeData>(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = data.question ?? '';
  const nodeState: NodeState = data.state ?? 'confirmed';

  const contextNodeIds = useNodeContext(id);
  const upstreamData = useUpstreamData(id);
  const pipelineContext = usePipelineContext();

  const setQuestion = useCallback(
    (value: string) => {
      updateNode({ question: value, error: undefined });
      setError(null);
    },
    [updateNode]
  );

  const hasContext = contextNodeIds.length > 0;
  const canDiagnose = hasContext;

  const handleDebug = useCallback(async () => {
    if (!canDiagnose) return;
    setLoading(true);
    setError(null);
    updateNode({ error: undefined });
    try {
      const schema: EditNodesSchema | undefined = upstreamData?.columns?.length
        ? { columns: upstreamData.columns.map((c) => ({ name: c.name, type: c.type })) }
        : undefined;
      const sampleRows =
        upstreamData?.rows?.slice(0, 10) as Record<string, unknown>[] | undefined;

      const { diagnosis } = await diagnoseNodesWithAi({
        nodeIds: contextNodeIds,
        question: question.trim() || undefined,
        schema,
        sampleRows: sampleRows?.length ? sampleRows : undefined,
        pipelineContext,
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
          content: diagnosis,
          sourceNodeId: id,
          sourceLabel: SOURCE_LABEL,
          noteKind: 'diagnosis',
        },
      });
    } catch (err) {
      console.error('Diagnose failed:', err);
      const message = err instanceof Error ? err.message : 'Diagnose failed. Please try again.';
      setError(message);
      updateNode({ error: message });
    } finally {
      setLoading(false);
    }
  }, [canDiagnose, contextNodeIds, question, upstreamData, pipelineContext, id, nodes, addNode, updateNode]);

  return (
    <BaseNode
      nodeId={id}
      state={nodeState}
      title="Debug"
      icon={<Bug size={16} />}
      selected={selected}
      inputs={1}
      outputs={0}
      errorMessage={data.error}
    >
      <div className="space-y-3">
        {!hasContext && (
          <p className={cn(caption, 'text-amber-600')}>
            Connect to a node to diagnose.
          </p>
        )}
        {hasContext && (
          <>
            <div>
              <label className="sr-only">Optional question (e.g. Why is output empty?)</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., Why is the output empty? Why did row count drop?"
                className={cn(input.default, 'min-h-[60px] resize-y text-sm')}
                disabled={loading}
              />
            </div>
            <AiCallButton
              label="Debug"
              loadingLabel="Diagnosing"
              loading={loading}
              disabled={!canDiagnose}
              onClick={handleDebug}
              className="w-full"
            />

            {error && <AiErrorAlert message={error} />}
          </>
        )}
      </div>
    </BaseNode>
  );
}
