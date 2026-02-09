import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env variable)
let client;
try {
  client = new Anthropic();
} catch {
  console.warn(
    'Warning: ANTHROPIC_API_KEY not set. AI features will return mock data.'
  );
}

// ─── System Prompt ──────────────────────────────────────────────────────────

const PIPELINE_SYSTEM_PROMPT = `You are a data visualization assistant for Convoy, a canvas-based tool for creating data visualizations.

Given a user's request and a data schema, generate a pipeline of transformation nodes that will produce the requested visualization.

Available node types:
- filter: { column: string, operator: "eq"|"neq"|"gt"|"lt"|"contains"|"startsWith", value: string }
- groupBy: { groupByColumn: string, aggregateColumn: string, aggregation: "count"|"sum"|"avg"|"min"|"max" }
- sort: { column: string, direction: "asc"|"desc" }
- select: { columns: string[] }
- computedColumn: { newColumnName: string, expression: string } — creates a new column from a JS expression using each row as 'd', e.g. "d.population / d.area"
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

// ─── Mock Pipeline Generator ────────────────────────────────────────────────

function generateMockPipeline(prompt, schema) {
  const columns = schema.columns || [];
  const numericCols = columns.filter((c) => c.type === 'number');
  const stringCols = columns.filter((c) => c.type === 'string');

  const nodes = [];
  const promptLower = prompt.toLowerCase();

  // Try to detect intent from prompt
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
          numericCols.length > 0
            ? numericCols[0].name
            : stringCols[0].name,
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

  // Determine chart type from prompt
  let chartType = 'bar';
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

// ─── Routes ─────────────────────────────────────────────────────────────────

app.post('/api/generate-pipeline', async (req, res) => {
  const { prompt, schema } = req.body;

  if (!prompt || !schema) {
    return res.status(400).json({ error: 'Missing prompt or schema' });
  }

  // If no API key, return mock data
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

    // Extract JSON from response (Claude might wrap it in markdown code blocks)
    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const pipeline = JSON.parse(jsonMatch[0]);

    // Validate the pipeline structure
    if (!pipeline.nodes || !Array.isArray(pipeline.nodes)) {
      throw new Error('Invalid pipeline structure: missing nodes array');
    }

    res.json(pipeline);
  } catch (error) {
    console.error('Pipeline generation error:', error);

    // Fallback to mock on error
    console.log('Falling back to mock pipeline');
    const mock = generateMockPipeline(prompt, schema);
    res.json(mock);
  }
});

// ─── Explanation System Prompt ───────────────────────────────────────────────

const EXPLANATION_SYSTEM_PROMPT = `You are explaining data transformations to non-technical researchers.
Be concise (1-2 sentences). Use simple language.
Focus on WHAT it does, not HOW it works technically.
Do not use code or technical jargon.
Do not use markdown formatting.`;

// ─── Mock Explanation Generator ─────────────────────────────────────────────

function generateMockExplanation(nodeType, config, inputRowCount, outputRowCount) {
  const rowSummary =
    inputRowCount !== undefined && outputRowCount !== undefined
      ? `, reducing your data from ${inputRowCount} to ${outputRowCount} entries`
      : '';

  switch (nodeType) {
    case 'filter': {
      const opLabels = {
        eq: 'is equal to',
        neq: 'is not equal to',
        gt: 'is greater than',
        lt: 'is less than',
        contains: 'contains',
        startsWith: 'starts with',
      };
      const op = opLabels[config.operator] || config.operator || 'matches';
      return `This keeps only rows where "${config.column || 'the column'}" ${op} "${config.value || ''}"${rowSummary}.`;
    }
    case 'groupBy': {
      const aggLabels = {
        count: 'counts',
        sum: 'adds up',
        avg: 'averages',
        min: 'finds the minimum of',
        max: 'finds the maximum of',
      };
      const aggLabel = aggLabels[config.aggregation] || config.aggregation || 'aggregates';
      return `This groups your data by "${config.groupByColumn || 'the column'}" and ${aggLabel} the "${config.aggregateColumn || 'values'}" for each group${rowSummary}.`;
    }
    case 'sort':
      return `This arranges your data by "${config.column || 'the column'}" in ${config.direction === 'desc' ? 'descending (highest first)' : 'ascending (lowest first)'} order.`;
    case 'select':
      return `This keeps only the columns you selected${config.columns?.length ? ': ' + config.columns.join(', ') : ''}, removing all others.`;
    case 'chart': {
      const typeLabels = {
        bar: 'bar chart',
        line: 'line chart',
        area: 'area chart',
        scatter: 'scatter plot',
        pie: 'pie chart',
      };
      const chartLabel = typeLabels[config.chartType] || 'chart';
      return `This creates a ${chartLabel} showing "${config.yAxis || 'values'}" for each "${config.xAxis || 'category'}".`;
    }
    case 'dataSource':
      return `This loads your data file${config.fileName ? ' "' + config.fileName + '"' : ''} so it can be used in the pipeline.`;
    default:
      return `This step processes your data as part of the pipeline.`;
  }
}

app.post('/api/explain-node', async (req, res) => {
  const { nodeType, config, inputRowCount, outputRowCount } = req.body;

  if (!nodeType) {
    return res.status(400).json({ error: 'Missing nodeType' });
  }

  // If no API key, return mock explanation
  if (!client) {
    console.log('No API key — returning mock explanation');
    const explanation = generateMockExplanation(nodeType, config || {}, inputRowCount, outputRowCount);
    return res.json({ explanation });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: EXPLANATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Explain this ${nodeType} node in plain English:

Configuration: ${JSON.stringify(config || {}, null, 2)}
${inputRowCount !== undefined ? `Input: ${inputRowCount} rows` : ''}
${outputRowCount !== undefined ? `Output: ${outputRowCount} rows` : ''}

One sentence explanation:`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    res.json({ explanation: content.text.trim() });
  } catch (error) {
    console.error('Explanation generation error:', error);

    // Fallback to mock on error
    console.log('Falling back to mock explanation');
    const explanation = generateMockExplanation(nodeType, config || {}, inputRowCount, outputRowCount);
    res.json({ explanation });
  }
});

// ─── CSV Proxy Endpoint ──────────────────────────────────────────────────────

app.get('/api/fetch-csv', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const parsedUrl = new URL(url);
    // Only allow http(s) URLs
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP/HTTPS URLs are supported');
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'text/csv, text/plain, */*',
        'User-Agent': 'Convoy/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).send(`Remote server returned ${response.status}`);
    }

    const text = await response.text();
    res.type('text/csv').send(text);
  } catch (error) {
    console.error('CSV fetch error:', error.message);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).send('Request timed out');
    }
    res.status(500).send(error.message || 'Failed to fetch URL');
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!client,
  });
});

app.listen(PORT, () => {
  console.log(`Convoy API server running on http://localhost:${PORT}`);
  if (!client) {
    console.log(
      'Set ANTHROPIC_API_KEY environment variable to enable AI features.'
    );
  }
});
