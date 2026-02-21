import express from 'express';
import { getClient } from '../lib/ai.js';

const router = express.Router();

const EDIT_NODES_SYSTEM_PROMPT = `You are a data visualization assistant for Convoy. The user has selected one or more nodes on the canvas and wants to edit them with a natural language prompt.

You will receive:
1. Selected node IDs and their current configuration (and optional customCode for code-mode nodes).
2. Optional data schema (columns) and pipeline context (nodes and edges) for reference.
3. The user's edit prompt.

Respond ONLY with a JSON object. No markdown, no explanation outside the JSON.
Format:
{
  "updates": {
    "<nodeId>": { "config": { ... } },
    "<nodeId>": { "customCode": "..." },
    "<nodeId>": { "config": { ... }, "customCode": "..." }
  }
}

Rules:
- Only include node IDs that were in the selected list.
- For each node, include only the keys that should change (config and/or customCode). Omit a node if no change.
- config must be a valid partial or full config for that node type (filter, groupBy, sort, select, chart, computedColumn, reshape, etc.).
- customCode is a string (JavaScript) for nodes that support code mode.
- Preserve any fields the user did not ask to change. Merge updates into existing config where appropriate.`;

router.post('/edit-nodes', async (req, res) => {
  const { nodeIds, prompt, schema, pipelineContext } = req.body;

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0 || !prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid nodeIds or prompt' });
  }

  const client = getClient();
  if (!client) {
    console.log('No API key — returning empty updates');
    return res.json({ updates: {} });
  }

  try {
    const selectedSummary = (pipelineContext?.nodes || [])
      .filter((n) => nodeIds.includes(n.id))
      .map((n) => ({
        id: n.id,
        type: n.type,
        config: n.data || {},
        customCode: n.data?.customCode,
      }));

    const userContent = `Selected nodes to edit:
${JSON.stringify(selectedSummary, null, 2)}
${schema?.columns ? `\nData schema (columns): ${JSON.stringify(schema.columns)}` : ''}
${pipelineContext?.nodes?.length ? `\nAll pipeline nodes (id, type): ${JSON.stringify((pipelineContext.nodes || []).map((n) => ({ id: n.id, type: n.type })))}` : ''}
${pipelineContext?.edges?.length ? `\nEdges: ${JSON.stringify((pipelineContext.edges || []).map((e) => ({ source: e.source, target: e.target })))}` : ''}

User edit prompt: "${prompt}"

Respond with a single JSON object with an "updates" key mapping nodeId to { config?, customCode? }:`;

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
      return res.json({ updates: {} });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const updates = parsed.updates && typeof parsed.updates === 'object' ? parsed.updates : {};

    // Restrict to requested node IDs only
    const allowed = Object.fromEntries(
      nodeIds.filter((id) => updates[id] != null).map((id) => [id, updates[id]])
    );

    res.json({ updates: allowed });
  } catch (error) {
    console.error('Edit nodes error:', error);
    res.status(500).json({
      error: 'Failed to generate edits',
      updates: {},
    });
  }
});

export default router;
