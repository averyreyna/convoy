import { useState, useCallback, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { type EditNodesResponse } from '@/lib/api';
import { suggestPipelineForContext } from '@/lib/aiNodes';
import { BaseNode } from '../core/BaseNode';
import type { AiQueryNodeData, NodeState } from '@/types';
import { button, input, caption, panelSectionHeader, divider } from '@/flank';
import { useNodeContext, useDataSourceSchema, usePipelineContext, useNodeUpdate } from '../hooks';
import { AiCallButton } from './AiCallButton';
import { AiErrorAlert } from './AiErrorAlert';
import { AiSuggestionList } from './AiSuggestionList';

type AiQueryNodeProps = NodeProps & {
  data: AiQueryNodeData;
};

export function AiQueryNode({ id, data, selected }: AiQueryNodeProps) {
  const replaceNodesWithSuggestedPipeline = useCanvasStore((s) => s.replaceNodesWithSuggestedPipeline);

  const [suggestedPipeline, setSuggestedPipeline] = useState<EditNodesResponse['suggestedPipeline'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true);

  const query = data.query ?? '';
  const nodeState: NodeState = data.state ?? 'confirmed';

  const contextNodeIds = useNodeContext(id);
  const dataSchema = useDataSourceSchema();
  const pipelineContext = usePipelineContext();
  const updateNode = useNodeUpdate<AiQueryNodeData>(id);

  const setQuery = useCallback(
    (value: string) => {
      updateNode({ query: value });
      setError(null);
      setSuggestedPipeline(null);
    },
    [updateNode]
  );

  const handleSuggest = useCallback(async () => {
    if (!query.trim() || contextNodeIds.length === 0) return;
    setLoading(true);
    setError(null);
    setSuggestedPipeline(null);
    try {
      const res: EditNodesResponse = await suggestPipelineForContext({
        nodeIds: contextNodeIds,
        prompt: query.trim(),
        schema: dataSchema ?? undefined,
        pipelineContext,
      });
      const pipeline = res.suggestedPipeline;
      if (!pipeline?.nodes?.length) {
        setError(
          'AI returned no suggestions. Try a more specific prompt or check that the connected nodes have data.'
        );
        return;
      }
      setSuggestedPipeline(pipeline);
    } catch (err) {
      console.error('AI suggest failed:', err);
      setError(err instanceof Error ? err.message : 'Suggest failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, contextNodeIds, dataSchema, pipelineContext]);

  const handleApply = useCallback(() => {
    if (!suggestedPipeline?.nodes?.length) return;
    const nodeIdsToReplace = contextNodeIds.filter(
      (nid) => pipelineContext.nodes.find((n) => n.id === nid)?.type !== 'dataSource'
    );
    const dataSourceInContext = contextNodeIds.find(
      (nid) => pipelineContext.nodes.find((n) => n.id === nid)?.type === 'dataSource'
    );
    if (nodeIdsToReplace.length === 0 && dataSourceInContext) {
      replaceNodesWithSuggestedPipeline([], suggestedPipeline, {
        insertAfterNodeId: dataSourceInContext,
      });
    } else if (nodeIdsToReplace.length > 0) {
      replaceNodesWithSuggestedPipeline(nodeIdsToReplace, suggestedPipeline);
    } else {
      replaceNodesWithSuggestedPipeline(contextNodeIds, suggestedPipeline);
    }
    setSuggestedPipeline(null);
  }, [suggestedPipeline, contextNodeIds, pipelineContext.nodes, replaceNodesWithSuggestedPipeline]);

  const hasContext = contextNodeIds.length > 0;
  const canSuggest = hasContext && query.trim().length > 0;

  const suggestedNodes = useMemo(() => suggestedPipeline?.nodes ?? [], [suggestedPipeline]);

  return (
    <BaseNode
      nodeId={id}
      state={nodeState}
      title="Query with AI"
      icon={<Sparkles size={16} />}
      selected={selected}
      inputs={1}
      outputs={0}
    >
      <div className="space-y-3">
        {!hasContext && (
          <p className={cn(caption, 'text-amber-600')}>Connect nodes to suggest edits.</p>
        )}
        <div>
          <label className="sr-only">Natural language query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Filter to rows where column X is greater than 100"
            className={cn(input.default, 'min-h-[72px] resize-y text-sm')}
            disabled={loading}
          />
        </div>
        <AiCallButton
          label="Suggest"
          loadingLabel="Suggest"
          loading={loading}
          disabled={!canSuggest}
          onClick={handleSuggest}
          className="w-full"
        />

        {error && <AiErrorAlert message={error} />}

        {suggestedPipeline && suggestedNodes.length > 0 && (
          <AiSuggestionList
            suggestedNodes={suggestedNodes}
            expanded={suggestionsExpanded}
            onToggleExpanded={() => setSuggestionsExpanded((x) => !x)}
            onApply={handleApply}
          />
        )}
      </div>
    </BaseNode>
  );
}
