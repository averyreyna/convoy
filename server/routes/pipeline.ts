import express, { Request, Response } from 'express';
import { getClient } from '../lib/ai.ts';
import type { ProposedPipeline } from '../../src/types/index.ts';

const router = express.Router();

const PIPELINE_SYSTEM_PROMPT = `You are a data visualization assistant for Convoy, a canvas-based tool for creating data visualizations.

Given a user's request and a data schema, generate a pipeline of transformation nodes that will produce the requested visualization.

Available node types:
- filter: { column: string, operator: "eq"|"neq"|"gt"|"lt"|"contains"|"startsWith", value: string }
- groupBy: { groupByColumn: string, aggregateColumn: string, aggregation: "count"|"sum"|"avg"|"min"|"max" }
- sort: { column: string, direction: "asc"|"desc" }
- select: { columns: string[] }
- computedColumn: { newColumnName: string, expression: string } — creates a new column from a Python expression using dataframe columns, e.g. "df[\"population\"] / df[\"area\"]"
- reshape: { keyColumn: string, valueColumn: string, pivotColumns: string[] } — unpivots wide data to long format
- chart: { chartType: "bar"|"line"|"area"|"scatter"|"pie", xAxis: string, yAxis: string, colorBy?: string }

Rules:
1. Respond ONLY with a JSON object, no other text.
2. Use this exact format:
{
  "nodes": [
    { "type": "filter", "config": { ... } },
    { "type": "chart", "config": { ... } }
  ],
  "explanation": "Brief explanation of what this pipeline does"
}
3. Only include necessary nodes. Do not add unnecessary transformations.
4. Always end with a chart node.
5. Use exact column names from the provided schema.
6. For groupBy with "count" aggregation, set aggregateColumn to the groupByColumn.
7. The yAxis in the chart node should match the output column name after transformations (e.g., after a count groupBy, the yAxis is the aggregateColumn name).`;

interface SchemaColumn {
  name: string;
  type: string;
}

interface PipelineRequestBody {
  prompt?: string;
  schema?: { columns?: SchemaColumn[] };
}

function generateMockPipeline(
  prompt: string,
  schema: { columns?: SchemaColumn[] }
): ProposedPipeline {
  const columns = schema.columns || [];
  const numericCols = columns.filter((c) => c.type === 'number');
  const stringCols = columns.filter((c) => c.type === 'string');

  const nodes: ProposedPipeline['nodes'] = [];
  const promptLower = prompt.toLowerCase();

  const hasFilter =
    promptLower.includes('filter') ||
    promptLower.includes('only') ||
    promptLower.includes('where') ||
    promptLower.includes('just');
  const hasGroup =
    promptLower.includes('by') ||
    promptLower.includes('group') ||
    promptLower.includes('per') ||
    promptLower.includes('each') ||
    promptLower.includes('count');
  const hasSort =
    promptLower.includes('sort') ||
    promptLower.includes('top') ||
    promptLower.includes('bottom') ||
    promptLower.includes('highest') ||
    promptLower.includes('lowest');

  if (hasFilter && stringCols.length > 0) {
    nodes.push({
      type: 'filter',
      config: {
        column: stringCols[0].name,
        operator: 'contains',
        value: '',
      },
    });
  }

  if (hasGroup && stringCols.length > 0) {
    nodes.push({
      type: 'groupBy',
      config: {
        groupByColumn: stringCols[0].name,
        aggregateColumn:
          numericCols.length > 0 ? numericCols[0].name : stringCols[0].name,
        aggregation: numericCols.length > 0 ? 'sum' : 'count',
      },
    });
  }

  if (hasSort) {
    const sortCol =
      numericCols.length > 0 ? numericCols[0].name : columns[0]?.name || '';
    nodes.push({
      type: 'sort',
      config: { column: sortCol, direction: 'desc' },
    });
  }

  let chartType: 'bar' | 'line' | 'area' | 'scatter' | 'pie' = 'bar';
  if (promptLower.includes('line')) chartType = 'line';
  else if (promptLower.includes('area')) chartType = 'area';
  else if (promptLower.includes('scatter')) chartType = 'scatter';
  else if (promptLower.includes('pie')) chartType = 'pie';

  const xAxis = stringCols.length > 0 ? stringCols[0].name : columns[0]?.name || '';
  const yAxis = numericCols.length > 0 ? numericCols[0].name : columns[1]?.name || '';

  nodes.push({
    type: 'chart',
    config: { chartType, xAxis, yAxis },
  });

  return {
    nodes,
    explanation: `Mock pipeline: processes data and creates a ${chartType} chart of ${yAxis} by ${xAxis}.`,
  };
}

router.post('/generate-pipeline', async (req: Request, res: Response) => {
  const { prompt, schema } = req.body as PipelineRequestBody;

  if (!prompt || !schema) {
    return res.status(400).json({ error: 'Missing prompt or schema' });
  }

  const client = getClient();
  if (!client) {
    console.log('No API key — returning mock pipeline');
    const mock = generateMockPipeline(prompt, schema);
    return res.json(mock);
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: PIPELINE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Data schema:\n${JSON.stringify(schema.columns, null, 2)}\n\nUser request: "${prompt}"\n\nGenerate the pipeline JSON:`,
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

    const pipeline = JSON.parse(jsonMatch[0]) as ProposedPipeline;

    if (!pipeline.nodes || !Array.isArray(pipeline.nodes)) {
      throw new Error('Invalid pipeline structure: missing nodes array');
    }

    res.json(pipeline);
  } catch (error) {
    console.error('Pipeline generation error:', error);

    console.log('Falling back to mock pipeline');
    const mock = generateMockPipeline(prompt, schema);
    res.json(mock);
  }
});

export default router;
