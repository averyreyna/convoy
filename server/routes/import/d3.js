import express from 'express';
import { getClient } from '../../lib/ai.js';

const router = express.Router();

/**
 * Pattern-based parser for D3.js scripts. Infers dataSource (if d3.json/csv/dsv)
 * and chart node (chartType, xAxis, yAxis) from common D3 patterns.
 */
function parseD3Script(source) {
  const steps = [];
  let fallbackToLlm = false;

  const csvMatch = source.match(/d3\.(?:csv|dsv)\s*\(\s*["'`]([^"'`]+)["'`]/);
  const jsonMatch = source.match(/d3\.json\s*\(\s*["'`]([^"'`]+)["'`]/);
  if (jsonMatch) {
    steps.push({ type: 'dataSource', config: { fileName: jsonMatch[1] || 'data.json' } });
  } else if (csvMatch) {
    steps.push({ type: 'dataSource', config: { fileName: csvMatch[1] || 'data.csv' } });
  }

  let chartType = 'bar';
  if (/\bd3\.(?:arc|pie)\s*\(/.test(source) || /\.pie\s*\(/.test(source)) {
    chartType = 'pie';
  } else if (/\bd3\.area\s*\(/.test(source) || /\.area\s*\(/.test(source)) {
    chartType = 'area';
  } else if (/\bd3\.line\s*\(/.test(source) || /\.line\s*\(/.test(source)) {
    chartType = 'line';
  } else if (/\.append\s*\(\s*["']circle["']\s*\)/.test(source) || /\.attr\s*\(\s*["']cx["']/.test(source)) {
    chartType = 'scatter';
  } else if (/\bscaleBand\s*\(/.test(source) && (/\.append\s*\(\s*["']rect["']\s*\)/.test(source) || /["']rect["']/.test(source))) {
    chartType = 'bar';
  }

  let xAxis = '';
  const domainMapMatch = source.match(/\.domain\s*\(\s*data\.map\s*\(\s*d\s*=>\s*d\[["']([^"']+)["']\]\s*\)/);
  const domainMapMatch2 = source.match(/\.domain\s*\(\s*\w+\.map\s*\(\s*d\s*=>\s*d\[["']([^"']+)["']\]\s*\)/);
  const dKeyMatch = source.match(/d\[["']([^"']+)["']\](?=\s*\)|,|\s)/g);
  if (domainMapMatch) {
    xAxis = domainMapMatch[1];
  } else if (domainMapMatch2) {
    xAxis = domainMapMatch2[1];
  } else if (dKeyMatch && dKeyMatch.length > 0) {
    xAxis = dKeyMatch[0].replace(/d\[["']|["']\]/g, '');
  }

  let yAxis = '';
  const maxMatch = source.match(/d3\.max\s*\(\s*(?:data|\w+)\s*,\s*d\s*=>\s*(?:\+?d\[["']([^"']+)["']\]|[\s\S]*?d\[["']([^"']+)["']\])/);
  if (maxMatch) {
    yAxis = maxMatch[1] || maxMatch[2] || '';
  }
  const dValMatch = source.match(/d\[["']([^"']+)["']\](?!\s*\))/g);
  if (!yAxis && dValMatch && dValMatch.length >= 2) {
    yAxis = dValMatch[1]?.replace(/d\[["']|["']\]/g, '') || '';
  }
  if (!yAxis && chartType === 'pie') {
    const valueMatch = source.match(/\.value\s*\(\s*d\s*=>\s*d\[["']([^"']+)["']\]\s*\)/);
    if (valueMatch) yAxis = valueMatch[1];
  }

  if (!xAxis) xAxis = 'category';
  if (!yAxis) yAxis = 'value';

  steps.push({
    type: 'chart',
    config: { chartType, xAxis, yAxis },
  });

  return { steps, fallbackToLlm };
}

const IMPORT_FROM_D3_SYSTEM_PROMPT = `You are a data visualization assistant for Convoy. Given a D3.js (JavaScript) script, infer a Convoy pipeline that represents the same visualization.

Convoy pipeline format:
- dataSource: { fileName: string } — include when the script loads data (d3.json, d3.csv, d3.dsv). Use the URL/path from the script or "data.csv"/"data.json" as placeholder.
- chart: { chartType: "bar"|"line"|"area"|"scatter"|"pie", xAxis: string, yAxis: string, colorBy?: string } — the main visualization. Infer chartType from the D3 code (scaleBand+rect → bar, d3.line → line, d3.area → area, circle/cx/cy → scatter, d3.pie/arc → pie). Use the exact data field names from the script for xAxis and yAxis (e.g. from data.map(d => d["name"]), .value(d => d["count"])).

Rules:
1. Respond ONLY with a JSON object, no other text.
2. Format:
{
  "nodes": [
    { "type": "dataSource", "config": { "fileName": "..." } },
    { "type": "chart", "config": { "chartType": "...", "xAxis": "...", "yAxis": "..." } }
  ],
  "explanation": "Brief description of the visualization"
}
3. If the script loads external data, the first node must be dataSource. Always end with a chart node.
4. Use exact property names from the script for xAxis and yAxis.`;

router.post('/', async (req, res) => {
  const { source } = req.body;

  if (!source || typeof source !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid source' });
  }

  let patternResult = null;
  try {
    patternResult = parseD3Script(source);
  } catch (err) {
    console.warn('Import from D3: pattern parser failed, using LLM', err.message);
  }

  const useLlm =
    !patternResult ||
    patternResult.fallbackToLlm === true ||
    !patternResult.steps ||
    patternResult.steps.length === 0;

  if (!useLlm && patternResult.steps.length > 0) {
    const pipeline = {
      nodes: patternResult.steps.map((s) => ({ type: s.type, config: s.config || {} })),
      explanation: 'Imported from D3.js script.',
    };
    return res.json({ pipeline, method: 'pattern' });
  }

  const client = getClient();
  if (!client) {
    return res.status(503).json({
      error: 'Import from D3 requires ANTHROPIC_API_KEY when the script cannot be parsed automatically.',
    });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: IMPORT_FROM_D3_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Convert this D3.js script into a Convoy pipeline JSON (dataSource + chart):\n\n\`\`\`javascript\n${source}\n\`\`\`\n\nOutput only the JSON object:`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const pipeline = JSON.parse(jsonMatch[0]);
    if (!pipeline.nodes || !Array.isArray(pipeline.nodes)) {
      throw new Error('Invalid pipeline structure: missing nodes array');
    }
    if (!pipeline.explanation) {
      pipeline.explanation = 'Imported from D3.js script (AI).';
    }

    res.json({ pipeline, method: 'llm' });
  } catch (error) {
    console.error('Import from D3 (LLM) error:', error);
    res.status(500).json({
      error: error.message || 'Failed to import pipeline from D3.',
    });
  }
});

export default router;
