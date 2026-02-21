import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import express from 'express';
import { getClient } from '../../lib/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

const IMPORT_FROM_PYTHON_SYSTEM_PROMPT = `You are a data pipeline assistant for Convoy. Given a Python/pandas script, infer a linear pipeline of Convoy nodes that mirrors the data processing steps.

Available node types and configs (use exact keys):
- dataSource: { fileName: string } — use when the script loads CSV/Excel (e.g. pd.read_csv). Use the file path from the script or "data.csv" as placeholder.
- filter: { column: string, operator: "eq"|"neq"|"gt"|"lt"|"contains"|"startsWith", value: string }
- groupBy: { groupByColumn: string, aggregateColumn: string, aggregation: "count"|"sum"|"avg"|"min"|"max" }
- sort: { column: string, direction: "asc"|"desc" }
- select: { columns: string[] }
- computedColumn: { newColumnName: string, expression: string }
- reshape: { keyColumn: string, valueColumn: string, pivotColumns: string[] }
- transform: { customCode: string } — for custom or complex steps; use a short snippet.
- chart: { chartType: "bar"|"line"|"area"|"scatter"|"pie", xAxis: string, yAxis: string }

Rules:
1. Respond ONLY with a JSON object, no other text.
2. Format:
{
  "nodes": [
    { "type": "dataSource", "config": { "fileName": "..." } },
    { "type": "filter", "config": { ... } },
    ...
  ],
  "explanation": "Brief description of the pipeline"
}
3. Preserve the order of operations from the script. If the script loads data first, the first node must be dataSource.
4. Use exact column and file names from the script.
5. For groupBy with count, set aggregateColumn to groupByColumn.
6. If the script has plotting (matplotlib/plt), add a chart node with appropriate chartType and axes from the plot.`;

function runPythonAstParser(source) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'parse_python_pipeline.py');
    const proc = spawn('python3', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.stdin.write(source, (err) => {
      if (err) {
        proc.kill();
        reject(err);
        return;
      }
      proc.stdin.end();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python script exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error('Invalid JSON from Python parser'));
      }
    });
    proc.on('error', reject);
  });
}

router.post('/', async (req, res) => {
  const { source } = req.body;

  if (!source || typeof source !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid source' });
  }

  let astResult = null;
  try {
    astResult = await runPythonAstParser(source);
  } catch (err) {
    console.warn('Import from Python: AST parser failed, using LLM', err.message);
  }

  const useLlm =
    !astResult ||
    astResult.fallbackToLlm === true ||
    !astResult.steps ||
    astResult.steps.length === 0;

  if (!useLlm && astResult.steps.length > 0) {
    const pipeline = {
      nodes: astResult.steps.map((s) => ({ type: s.type, config: s.config || {} })),
      explanation: 'Imported from Python script (AST).',
    };
    return res.json({ pipeline, method: 'ast' });
  }

  const client = getClient();
  if (!client) {
    return res.status(503).json({
      error: 'Import from Python requires ANTHROPIC_API_KEY when the script cannot be parsed automatically.',
    });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: IMPORT_FROM_PYTHON_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Convert this Python/pandas script into a Convoy pipeline JSON:\n\n\`\`\`python\n${source}\n\`\`\`\n\nOutput only the JSON object:`,
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
      pipeline.explanation = 'Imported from Python script (AI).';
    }

    res.json({ pipeline, method: 'llm' });
  } catch (error) {
    console.error('Import from Python (LLM) error:', error);
    res.status(500).json({
      error: error.message || 'Failed to import pipeline from Python.',
    });
  }
});

export default router;
