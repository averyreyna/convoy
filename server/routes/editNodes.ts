import express, { Request, Response } from 'express';
import { getClient } from '../lib/ai.ts';
import type {
  EditNodesRequestBody,
  EditNodesResponse,
  SuggestedPipelineNode,
} from '../../src/types/index.ts';

const router = express.Router();

const EDIT_NODES_SYSTEM_PROMPT = `You are a data visualization assistant for Convoy. The user has selected one or more nodes on the canvas and wants to edit them with a natural language prompt. Your response will REPLACE the selected nodes with a new chain of nodes.

You will receive a list of nodes in order (Node 0, Node 1, ...), optional data schema and pipeline context, and the user's edit prompt.

Respond ONLY with a JSON object. No markdown, no explanation outside the JSON.
Format:
{
  "suggestedPipeline": {
    "nodes": [
      { "type": "filter", "config": { "column": "...", "operator": "...", "value": "..." }, "label": "Optional label" },
      { "type": "transform", "customCode": "# Python code...", "label": "Optional" }
    ]
  },
  "explanation": "Brief optional explanation"
}

Config requirements (you MUST include a complete config for each node type so the Convoy UI can show all options):
- filter: config MUST include "column" (string, exact column name from schema), "operator" (one of: "eq", "neq", "gt", "lt", "contains", "startsWith"), and "value" (string). For "exclude X and Y" use operator "neq" with one value, or use type "transform" with customCode (e.g. ~df["col"].isin(["X","Y"])).
- groupBy: config MUST include "groupByColumn", "aggregateColumn", "aggregation" ("count"|"sum"|"avg"|"min"|"max"). For count, set aggregateColumn to groupByColumn.
- sort: config MUST include "column" and "direction" ("asc"|"desc").
- select: config MUST include "columns" (array of column name strings).
- chart: config MUST include "chartType" ("bar"|"line"|"area"|"scatter"|"pie"), "xAxis", "yAxis" (column names), and optionally "colorBy".
- computedColumn: config MUST include "newColumnName" and "expression" (Python expression using df columns).
- reshape: config MUST include "keyColumn", "valueColumn", "pivotColumns" (array of strings).
- transform: use when the edit is best expressed as custom Python; include "customCode" (string). You may still include "config": {} for consistency.

Rules:
- "suggestedPipeline.nodes" must be an array of node objects that REPLACE the selection. You may return the same number of nodes (1:1 edit), fewer, or more (e.g. split one node into several steps).
- Each node must have "type" (string). For filter, groupBy, sort, select, chart, computedColumn, reshape: always provide a complete "config" with ALL required fields above so the UI dropdowns and inputs are populated. Use "transform" with "customCode" only when the intent cannot be expressed with a typed node's config.
- customCode is Python that receives a dataframe "df" and returns the transformed dataframe. Use exact column names from the schema.
- The order of nodes is the pipeline order; edges are implicit (node[i] connects to node[i+1]).`;

interface ClaudeSuggestedNode {
  type?: string;
  config?: Record<string, unknown>;
  customCode?: string;
  label?: string;
}

interface ClaudeParsedResponse {
  suggestedPipeline?: { nodes?: unknown[] };
  explanation?: string;
}

router.post('/edit-nodes', async (req: Request, res: Response) => {
  const body = req.body as EditNodesRequestBody | undefined;
  const { nodeIds, prompt, schema, pipelineContext } = body ?? {};

  console.log('[edit-nodes] Request:', {
    nodeIds,
    promptLength: typeof prompt === 'string' ? prompt.length : 0,
    hasSchema: Boolean(schema?.columns?.length),
    pipelineNodeCount: pipelineContext?.nodes?.length ?? 0,
  });

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0 || !prompt || typeof prompt !== 'string') {
    console.log('[edit-nodes] Rejected: missing or invalid nodeIds or prompt');
    res.status(400).json({ error: 'Missing or invalid nodeIds or prompt' });
    return;
  }

  const client = getClient();
  if (!client) {
    console.log('[edit-nodes] No API key — returning empty suggestedPipeline');
    res.json({ suggestedPipeline: { nodes: [] } });
    return;
  }

  try {
    type PipelineNode = NonNullable<EditNodesRequestBody['pipelineContext']>['nodes'][number];
    type PipelineEdge = NonNullable<EditNodesRequestBody['pipelineContext']>['edges'][number];
    interface SelectedNodeSummary {
      type?: string;
      config: Record<string, unknown>;
      customCode?: string;
    }
    const selectedSummary: SelectedNodeSummary[] = (pipelineContext?.nodes || [] as PipelineNode[])
      .filter((n: PipelineNode) => nodeIds.includes(n.id))
      .map((n: PipelineNode): SelectedNodeSummary => ({
        type: n.type,
        config: n.data || {},
        customCode: typeof n.data?.customCode === 'string' ? n.data.customCode : undefined,
      }));

    const n = selectedSummary.length;
    const nodesList = selectedSummary
      .map((node, i) => `Node ${i}: ${JSON.stringify(node)}`)
      .join('\n');

    console.log('[edit-nodes] Selected summary for Claude:', n, 'nodes');

    const userContent = `Nodes to edit (in order, ${n} total):
${nodesList}
${schema?.columns ? `\nData schema (columns): ${JSON.stringify(schema.columns)}` : ''}
${pipelineContext?.nodes?.length ? `\nAll pipeline nodes (id, type): ${JSON.stringify((pipelineContext.nodes || []).map((n: PipelineNode) => ({ id: n.id, type: n.type })))}` : ''}
${pipelineContext?.edges?.length ? `\nEdges: ${JSON.stringify((pipelineContext.edges || []).map((e: PipelineEdge) => ({ source: e.source, target: e.target })))}` : ''}

User edit prompt: "${prompt}"

CRITICAL: For filter nodes set "column" to an exact column name from the schema (e.g. "country", "gdpPerCapita"). For groupBy set "groupByColumn" and "aggregateColumn" to exact schema column names. This populates the UI dropdowns correctly.

Respond with a single JSON object with "suggestedPipeline": { "nodes": [ ... ] } where each node has "type" and at least one of "config" or "customCode". These nodes will replace the selected nodes in order.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: EDIT_NODES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[edit-nodes] No JSON object in Claude response (length', text.length, ') — returning empty suggestedPipeline. First 200 chars:', text.slice(0, 200));
      res.json({ suggestedPipeline: { nodes: [] } });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as ClaudeParsedResponse;
    const rawNodes = Array.isArray(parsed.suggestedPipeline?.nodes) ? parsed.suggestedPipeline.nodes : [];
    const nodes: SuggestedPipelineNode[] = [];

    for (const raw of rawNodes) {
      const item = raw as ClaudeSuggestedNode;
      if (!item || typeof item !== 'object' || typeof item.type !== 'string') continue;
      if (item.config == null && item.customCode === undefined) continue;
      const node: SuggestedPipelineNode = {
        type: item.type,
        ...(item.config != null && typeof item.config === 'object' && { config: item.config }),
        ...(typeof item.customCode === 'string' && { customCode: item.customCode }),
        ...(typeof item.label === 'string' && { label: item.label }),
      };
      nodes.push(node);
    }

    // Normalize: ensure config is set when we only had customCode (so store can build node data)
    const schemaColumns = schema?.columns?.map((c: { name: string }) => c.name) ?? [];
    const normalizedNodes: SuggestedPipelineNode[] = nodes.map((node) => {
      const config = node.config ?? {};
      const out = { ...node, config: { ...config } };
      if (schemaColumns.length > 0) {
        if (node.type === 'filter') {
          if (typeof out.config.column !== 'string') out.config.column = schemaColumns[0];
          if (typeof out.config.operator !== 'string') out.config.operator = 'eq';
        }
        if (node.type === 'groupBy') {
          if (typeof out.config.groupByColumn !== 'string') out.config.groupByColumn = schemaColumns[0];
          if (typeof out.config.aggregateColumn !== 'string') out.config.aggregateColumn = schemaColumns[0];
          if (typeof out.config.aggregation !== 'string') out.config.aggregation = 'count';
        }
      }
      return out;
    });

    console.log('[edit-nodes] Returning suggestedPipeline with', normalizedNodes.length, 'nodes');
    if (normalizedNodes.length === 0 && text.length > 0) {
      console.log('[edit-nodes] Claude response snippet (no valid nodes):', text.slice(0, 400));
    }

    const responseBody: EditNodesResponse = {
      suggestedPipeline: { nodes: normalizedNodes },
      ...(typeof parsed.explanation === 'string' && { explanation: parsed.explanation }),
    };
    res.json(responseBody);
  } catch (error) {
    console.error('[edit-nodes] Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('[edit-nodes] Stack:', error.stack);
    }
    const message =
      error instanceof Error ? error.message : 'Failed to generate edits';
    res.status(500).json({
      error: message,
      suggestedPipeline: { nodes: [] },
    });
  }
});

export default router;
