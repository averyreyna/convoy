import express, { Request, Response } from 'express';
import { getClient } from '../lib/ai.ts';

const router = express.Router();

const CLEAN_DATA_SYSTEM_PROMPT = `You are a data cleaning assistant for Convoy. The user has a pandas DataFrame named "df" and will describe in natural language what they want to filter out or clean.

You will receive:
1. A data schema (column names and types).
2. Optional sample rows (first few rows of the data).
3. The user's instruction (e.g. "Remove rows where status is empty", "Drop duplicates by id", "Filter out rows where amount is negative").

Respond ONLY with a single JSON object. No markdown, no explanation outside the JSON.
Format:
{ "code": "..." }

The "code" must be valid Python that:
- Assumes a pandas DataFrame "df" is already in scope.
- Modifies or reassigns "df" so that the result is the cleaned DataFrame (e.g. df = df[...], df = df.dropna(), df = df.drop_duplicates(subset=[...])).
- Uses only column names from the schema; no file I/O, no network calls.
- Is a single block of Python (multiple lines OK). The last value of "df" is the output.`;

interface CleanDataRequestBody {
  instruction?: string;
  schema?: { columns: Array<{ name: string; type: string }> };
  sampleRows?: Record<string, unknown>[];
}

router.post('/clean-data', async (req: Request, res: Response) => {
  const body = req.body as CleanDataRequestBody | undefined;
  const { instruction, schema, sampleRows } = body ?? {};

  if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
    res.status(400).json({ error: 'Missing or invalid instruction' });
    return;
  }

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
${sample.length > 0 ? `Sample rows (first ${sample.length}): ${JSON.stringify(sample)}` : ''}

User instruction: "${instruction.trim()}"

Respond with a single JSON object: { "code": "your Python code here" }`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CLEAN_DATA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[clean-data] No JSON in response, length', text.length);
      res.status(500).json({ error: 'Invalid response: no JSON object' });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { code?: string };
    if (typeof parsed.code !== 'string' || !parsed.code.trim()) {
      res.status(500).json({ error: 'Invalid response: missing or empty code' });
      return;
    }

    res.json({ code: parsed.code.trim() });
  } catch (err) {
    console.error('[clean-data] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate cleaning code',
    });
  }
});

export default router;
