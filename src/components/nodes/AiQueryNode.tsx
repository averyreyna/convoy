import { useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { editNodes, type EditNodesResponse } from '@/lib/api';
import { generateNodeCode } from '@/lib/codeGenerators';
import {
  card,
  nodeHeader,
  nodeHeaderTitle,
  nodeHandle,
  button,
  input,
  alert,
  caption,
  panelSectionHeader,
  divider,
} from '@/design-system';

export interface AiQueryNodeData {
  label?: string;
  query?: string;
  state?: 'confirmed';
}

type AiQueryNodeProps = NodeProps;

export function AiQueryNode({ id, data, selected }: AiQueryNodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const replaceNodesWithSuggestedPipeline = useCanvasStore((s) => s.replaceNodesWithSuggestedPipeline);
  const nodeData = useDataStore((s) => s.nodeData);

  const [suggestedPipeline, setSuggestedPipeline] = useState<EditNodesResponse['suggestedPipeline'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true);

  const dataTyped = data as AiQueryNodeData;
  const query = dataTyped.query ?? '';

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

  const setQuery = useCallback(
    (value: string) => {
      updateNode(id, { query: value } as Record<string, unknown>);
      setError(null);
      setSuggestedPipeline(null);
    },
    [id, updateNode]
  );

  const handleSuggest = useCallback(async () => {
    if (!query.trim() || contextNodeIds.length === 0) return;
    setLoading(true);
    setError(null);
    setSuggestedPipeline(null);
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
      const res = await editNodes({
        nodeIds: contextNodeIds,
        prompt: query.trim(),
        schema: dataSchema ?? undefined,
        pipelineContext,
      });
      const pipeline = res.suggestedPipeline;
      if (!pipeline?.nodes?.length) {
        setError('AI returned no suggestions. Try a more specific prompt or check that the connected nodes have data.');
        return;
      }
      setSuggestedPipeline(pipeline);
    } catch (err) {
      console.error('AI suggest failed:', err);
      setError(err instanceof Error ? err.message : 'Suggest failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, contextNodeIds, nodes, edges, dataSchema]);

  const handleApply = useCallback(() => {
    if (!suggestedPipeline?.nodes?.length) return;
    const nodeIdsToReplace = contextNodeIds.filter(
      (nid) => nodes.find((n) => n.id === nid)?.type !== 'dataSource'
    );
    const dataSourceInContext = contextNodeIds.find(
      (nid) => nodes.find((n) => n.id === nid)?.type === 'dataSource'
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
  }, [suggestedPipeline, contextNodeIds, nodes, replaceNodesWithSuggestedPipeline]);

  const hasContext = contextNodeIds.length > 0;
  const canSuggest = hasContext && query.trim().length > 0;

  const suggestedNodes = useMemo(() => suggestedPipeline?.nodes ?? [], [suggestedPipeline]);

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
        <Sparkles size={18} className="text-violet-500" />
        <span className={nodeHeaderTitle}>Query with AI</span>
      </div>

      <div className="space-y-3 p-3">
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
        <button
          type="button"
          onClick={handleSuggest}
          disabled={!canSuggest || loading}
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
              Suggest
            </span>
          ) : (
            'Suggest'
          )}
        </button>

        {error && (
          <div className={cn(alert, 'flex items-start gap-2')}>
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {suggestedPipeline && suggestedNodes.length > 0 && (
          <div className={cn(divider, panelSectionHeader)}>
            <button
              type="button"
              onClick={() => setSuggestionsExpanded((x) => !x)}
              className={cn(button.base, button.variants.ghost, button.sizes.sm, 'w-full justify-start text-left')}
            >
              {suggestionsExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <span className={caption}>
                {suggestedNodes.length} node{suggestedNodes.length !== 1 ? 's' : ''} to add
              </span>
            </button>
            {suggestionsExpanded && (
              <div className="space-y-2 font-mono text-[10px]">
                {suggestedNodes.map((spec, index) => {
                  const label = spec.label ?? spec.type.charAt(0).toUpperCase() + spec.type.slice(1);
                  const code =
                    typeof spec.customCode === 'string' && spec.customCode.trim() !== ''
                      ? spec.customCode
                      : generateNodeCode(spec.type, spec.config ?? {});
                  return (
                    <div key={`suggested-${index}`} className="rounded border border-gray-200 bg-gray-50 p-2">
                      <div className="mb-1 font-medium text-gray-700">{label}</div>
                      <div className={caption}>Code</div>
                      <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-gray-100 px-1.5 py-1 text-[10px] text-gray-800">
                        {code}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={handleApply}
              className={cn(button.base, button.variants.primary, button.sizes.md, 'w-full')}
            >
              Apply all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
