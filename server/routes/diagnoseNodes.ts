import express, { Request, Response } from 'express';
import { getClient } from '../lib/ai.ts';
import type {
  EditNodesSchema,
  EditNodesPipelineContext,
} from '../../src/types/index.ts';

const router = express.Router();

const DIAGNOSE_NODES_SYSTEM_PROMPT = `You are a data pipeline debugging assistant. The user has connected a node to diagnose. You will receive: the selected node's type and config (from pipeline context), optional input/output row counts, the output schema and sample rows, and an optional user question.

Explain in plain language what the node does, why the output might be empty or why row count changed, and what to check. Be concise and actionable (1–3 short paragraphs). Do not suggest code unless the user explicitly asks. Use simple, conversational text; light markdown (bullets) is OK if it helps clarity.`;

interface DiagnoseNodesRequestBody {
  nodeIds?: string[];
  question?: string;
  schema?: EditNodesSchema;
  sampleRows?: Record<string, unknown>[];
  pipelineContext?: EditNodesPipelineContext;
}

interface DiagnoseNodesResponse {
  diagnosis: string;
}

router.post('/diagnose-nodes', async (req: Request, res: Response) => {
  const body = req.body as DiagnoseNodesRequestBody | undefined;
  const { nodeIds, question, schema, sampleRows, pipelineContext } = body ?? {};

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    return res.status(400).json({
      error: 'Missing or invalid nodeIds',
    });
  }

  const client = getClient();
  if (!client) {
    return res.status(503).json({
      error: 'AI service not configured (set ANTHROPIC_API_KEY)',
    });
  }

  type PipelineNode = NonNullable<EditNodesPipelineContext['nodes']>[number];
  const selectedNodes = (pipelineContext?.nodes ?? []).filter((n: PipelineNode) =>
    nodeIds.includes(n.id)
  );
  const nodeSummaries = selectedNodes
    .map(
      (n: PipelineNode, i: number) =>
        `Node ${i} (id: ${n.id}, type: ${n.type ?? 'unknown'}): ${JSON.stringify(n.data ?? {}, null, 2)}`
    )
    .join('\n\n');

  const schemaBlock = schema?.columns?.length
    ? `\nOutput schema (columns): ${JSON.stringify(schema.columns.map((c) => c.name))}`
    : '';
  const sample = Array.isArray(sampleRows) ? sampleRows.slice(0, 10) : [];
  const sampleBlock =
    sample.length > 0
      ? `\nOutput sample rows (first ${sample.length}): ${JSON.stringify(sample)}`
      : '\nOutput sample rows: (none – output may be empty)';

  const questionBlock =
    question && typeof question === 'string' && question.trim()
      ? `\nUser question: "${question.trim()}"`
      : '\nUser did not ask a specific question; explain what this node does and why the output looks the way it does (e.g. row count change, empty result).';

  const userContent = `Nodes to diagnose:

${nodeSummaries}
${schemaBlock}
${sampleBlock}
${questionBlock}

Provide a concise diagnosis:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: DIAGNOSE_NODES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    res.json({ diagnosis: content.text.trim() } as DiagnoseNodesResponse);
  } catch (error) {
    console.error('[diagnose-nodes] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to diagnose';
    res.status(500).json({ error: message });
  }
});

export default router;
