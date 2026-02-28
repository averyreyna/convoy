import { useState, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { answerQuestionAboutNodes } from '@/lib/aiNodes';
import type { AiAdvisorNodeData, NodeState } from '@/types';
import { BaseNode } from '../core/BaseNode';
import { button, input, caption } from '@/flank';
import { useNodeContext, useDataSourceSchema, usePipelineContext, useNodeUpdate } from '../hooks';
import { AiCallButton } from './AiCallButton';
import { AiErrorAlert } from './AiErrorAlert';

type AiAdvisorNodeProps = NodeProps & {
  data: AiAdvisorNodeData;
};

export function AiAdvisorNode({ id, data, selected }: AiAdvisorNodeProps) {
  const updateNode = useNodeUpdate<AiAdvisorNodeData>(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = data.question ?? '';
  const answer = data.answer ?? '';
  const nodeState: NodeState = data.state ?? 'confirmed';

  const contextNodeIds = useNodeContext(id);
  const dataSchema = useDataSourceSchema();
  const pipelineContext = usePipelineContext();

  const setQuestion = useCallback(
    (value: string) => {
      updateNode({ question: value });
      setError(null);
    },
    [updateNode]
  );

  const handleAsk = useCallback(async () => {
    if (!question.trim() || contextNodeIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await answerQuestionAboutNodes({
        nodeIds: contextNodeIds,
        question: question.trim(),
        schema: dataSchema ?? undefined,
        pipelineContext,
      });
      updateNode({ answer: res.answer });
    } catch (err) {
      console.error('Answer about nodes failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to get advice. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [question, contextNodeIds, dataSchema, pipelineContext, updateNode]);

  const handleClearAnswer = useCallback(() => {
    updateNode({ answer: undefined });
    setError(null);
  }, [updateNode]);

  const hasContext = contextNodeIds.length > 0;
  const canAsk = hasContext && question.trim().length > 0;

  return (
    <BaseNode
      nodeId={id}
      state={nodeState}
      title="Ask about nodes"
      icon={<MessageCircle size={16} />}
      selected={selected}
      inputs={1}
      outputs={0}
    >
      <div className="space-y-3">
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
            <AiCallButton
              label="Ask"
              loadingLabel="Ask"
              loading={loading}
              disabled={!canAsk}
              onClick={handleAsk}
              className="w-full"
            />

            {error && <AiErrorAlert message={error} />}

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
    </BaseNode>
  );
}
