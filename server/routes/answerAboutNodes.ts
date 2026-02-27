import express, { Request, Response } from 'express';
import { getClient } from '../lib/ai.ts';
import type {
  EditNodesSchema,
  EditNodesPipelineContext,
} from '../../src/types/index.ts';

const router = express.Router();

const ANSWER_ABOUT_NODES_SYSTEM_PROMPT = `You are a data pipeline advisor. The user has connected one or more nodes on the canvas and asked a question about them. Answer in plain language: give advice, next steps, or feedback. Do not suggest code or node edits unless the user explicitly asks. Be concise but helpful. You may use markdown for structure (headings, lists, code snippets) if it helps.`;

interface AnswerAboutNodesRequestBody {
  nodeIds?: string[];
  question?: string;
  schema?: EditNodesSchema;
  pipelineContext?: EditNodesPipelineContext;
}

interface AnswerAboutNodesResponse {
  answer: string;
}

router.post('/answer-about-nodes', async (req: Request, res: Response) => {
  const body = req.body as AnswerAboutNodesRequestBody | undefined;
  const { nodeIds, question, schema, pipelineContext } = body ?? {};

  if (
    !nodeIds ||
    !Array.isArray(nodeIds) ||
    nodeIds.length === 0 ||
    !question ||
    typeof question !== 'string' ||
    !question.trim()
  ) {
    return res.status(400).json({
      error: 'Missing or invalid nodeIds or question',
    });
  }

  const client = getClient();
  if (!client) {
    return res.json({
      answer:
        'Connect nodes and set ANTHROPIC_API_KEY to get advice.',
    } as AnswerAboutNodesResponse);
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
    ? `\nData schema (columns): ${JSON.stringify(schema.columns.map((c) => c.name))}`
    : '';
  const userContent = `Connected nodes (context for the question):

${nodeSummaries}
${schemaBlock}

User question: "${question.trim()}"

Provide helpful advice or answer:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: ANSWER_ABOUT_NODES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    res.json({ answer: content.text.trim() } as AnswerAboutNodesResponse);
  } catch (error) {
    console.error('[answer-about-nodes] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get advice';
    res.status(500).json({ error: message });
  }
});

export default router;
