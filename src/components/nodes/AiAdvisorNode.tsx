import { useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { answerAboutNodes } from '@/lib/api';
import type { AiAdvisorNodeData } from '@/types';
import {
  card,
  nodeHeader,
  nodeHeaderTitle,
  nodeHandle,
  button,
  input,
  alert,
  caption,
} from '@/design-system';

type AiAdvisorNodeProps = NodeProps;

export function AiAdvisorNode({ id, data, selected }: AiAdvisorNodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const nodeData = useDataStore((s) => s.nodeData);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataTyped = data as unknown as AiAdvisorNodeData;
  const question = dataTyped.question ?? '';
  const answer = dataTyped.answer ?? '';

  const contextNodeIds = useMemo(() => {
    return edges.filter((e) => e.target === id).map((e) => e.source);
  }, [edges, id]);

  const dataSchema = useMemo(() => {
    const dataSourceNode = nodes.find(
      (n) => n.type === 'dataSource' && (n.data as { state?: string })?.state === 'confirmed'
    );
    if (!dataSourceNode) return null;
    const d = nodeData[dataSourceNode.id];
    if (!d?.columns) return null;
    return { columns: d.columns };
  }, [nodes, nodeData]);

  const setQuestion = useCallback(
    (value: string) => {
      updateNode(id, { question: value } as Record<string, unknown>);
      setError(null);
    },
    [id, updateNode]
  );

  const handleAsk = useCallback(async () => {
    if (!question.trim() || contextNodeIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const pipelineContext = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data as Record<string, unknown>,
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      };
      const res = await answerAboutNodes({
        nodeIds: contextNodeIds,
        question: question.trim(),
        schema: dataSchema ?? undefined,
        pipelineContext,
      });
      updateNode(id, { answer: res.answer } as Record<string, unknown>);
    } catch (err) {
      console.error('Answer about nodes failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to get advice. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [question, contextNodeIds, nodes, edges, dataSchema, id, updateNode]);

  const handleClearAnswer = useCallback(() => {
    updateNode(id, { answer: undefined } as Record<string, unknown>);
    setError(null);
  }, [id, updateNode]);

  const hasContext = contextNodeIds.length > 0;
  const canAsk = hasContext && question.trim().length > 0;

  return (
    <div
      className={cn(
        'group relative',
        card.base,
        card.stateVariants.confirmed,
        selected && card.selected,
        'min-w-[280px] max-w-[360px]'
      )}
    >
      <Handle type="target" position={Position.Left} className={nodeHandle} />

      <div className={nodeHeader}>
        <MessageCircle size={18} className="text-violet-500" />
        <span className={nodeHeaderTitle}>Ask about nodes</span>
      </div>

      <div className="space-y-3 p-3">
        {!hasContext && (
          <p className={cn(caption, 'text-amber-600')}>
            Connect one or more nodes to ask about them.
          </p>
        )}
        {hasContext && (
          <>
            <div>
              <label className="sr-only">Question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., What should I do next? Is this filter too aggressive?"
                className={cn(input.default, 'min-h-[72px] resize-y text-sm')}
                disabled={loading}
              />
            </div>
            <button
              type="button"
              onClick={handleAsk}
              disabled={!canAsk || loading}
              className={cn(
                button.base,
                button.variants.primary,
                button.sizes.md,
                'w-full disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Ask
                </span>
              ) : (
                'Ask'
              )}
            </button>

            {error && (
              <div className={cn(alert, 'flex items-start gap-2')}>
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p className="text-xs">{error}</p>
              </div>
            )}

            {answer && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn(caption, 'font-medium text-gray-600')}>Answer</span>
                  <button
                    type="button"
                    onClick={handleClearAnswer}
                    className={cn(button.base, button.variants.ghost, button.sizes.sm)}
                  >
                    Clear
                  </button>
                </div>
                <div
                  className={cn(
                    'max-h-48 overflow-y-auto text-sm text-gray-800 leading-relaxed',
                    'whitespace-pre-wrap'
                  )}
                >
                  {answer}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
