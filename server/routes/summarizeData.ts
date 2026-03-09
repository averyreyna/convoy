import express, { Request, Response } from 'express';
import { getClient } from '../lib/ai.ts';

const router = express.Router();

const SUMMARIZE_DATA_SYSTEM_PROMPT = `You are a data summarization assistant for Convoy. The user has a dataset and wants a short, plain-language summary.

You will receive:
1. A data schema (column names and types).
2. Optional sample rows (first few rows).
3. An optional user prompt to focus the summary (e.g. "focus on date range", "highlight missing values").

Respond ONLY with a single JSON object. No markdown, no explanation outside the JSON.
Format:
{ "title": "Short descriptive title (5-10 words)", "summary": "..." }

- "title": A short phrase describing what the data is about (e.g. "Summary of NYC 311 Complaints", "Sales by Region Overview"). Use title case.
- "summary": 1–3 short paragraphs in plain English. Describe what the data contains: columns, sample values, row count if mentioned, and any notable patterns or issues. If the user provided a prompt, tailor the summary to that. Do not use markdown or code. Write in a friendly, readable way.`;

interface SummarizeDataRequestBody {
  schema?: { columns: Array<{ name: string; type: string }> };
  sampleRows?: Record<string, unknown>[];
  prompt?: string;
}

interface SummarizeDataResponse {
  title?: string;
  summary: string;
}

router.post('/summarize-data', async (req: Request, res: Response) => {
  const body = req.body as SummarizeDataRequestBody | undefined;
  const { schema, sampleRows, prompt } = body ?? {};

  if (!schema?.columns || !Array.isArray(schema.columns) || schema.columns.length === 0) {
    res.status(400).json({ error: 'Missing or invalid schema (columns required)' });
    return;
  }

  const client = getClient();
  if (!client) {
    res.status(503).json({ error: 'AI service not configured (set ANTHROPIC_API_KEY)' });
    return;
  }

  const sample = Array.isArray(sampleRows) ? sampleRows.slice(0, 10) : [];
  const userContent = `Schema: ${JSON.stringify(schema)}
${sample.length > 0 ? `Sample rows (first ${sample.length}): ${JSON.stringify(sample)}` : 'No sample rows provided.'}
${prompt && typeof prompt === 'string' && prompt.trim() ? `User focus: "${prompt.trim()}"` : ''}

Provide a JSON object with "title" and "summary".`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SUMMARIZE_DATA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[summarize-data] No JSON in response');
      res.status(500).json({ error: 'Invalid response: no JSON object' });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { title?: string; summary?: string };
    if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
      res.status(500).json({ error: 'Invalid response: missing or empty summary' });
      return;
    }

    res.json({
      title: typeof parsed.title === 'string' ? parsed.title.trim() : undefined,
      summary: parsed.summary.trim(),
    } as SummarizeDataResponse);
  } catch (err) {
    console.error('[summarize-data] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to summarize data',
    });
  }
});

export default router;
