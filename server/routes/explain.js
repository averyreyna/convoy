import express from 'express';
import { getClient } from '../lib/ai.js';

const router = express.Router();

const EXPLANATION_SYSTEM_PROMPT = `You are explaining data transformations to non-technical researchers.
Be concise (1-2 sentences). Use simple language.
Focus on WHAT it does, not HOW it works technically.
Do not use code or technical jargon.
Do not use markdown formatting.`;

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

router.post('/explain-node', async (req, res) => {
  const { nodeType, config, inputRowCount, outputRowCount } = req.body;

  if (!nodeType) {
    return res.status(400).json({ error: 'Missing nodeType' });
  }

  const client = getClient();
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

    console.log('Falling back to mock explanation');
    const explanation = generateMockExplanation(nodeType, config || {}, inputRowCount, outputRowCount);
    res.json({ explanation });
  }
});

export default router;
