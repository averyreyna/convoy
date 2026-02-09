/**
 * API client for Convoy.
 * Communicates with the Express backend that wraps the Anthropic Claude API.
 */

import type { ProposedPipeline } from '@/types';

interface DataSchema {
  columns: Array<{ name: string; type: string }>;
}

/**
 * Generate a pipeline of transformation nodes from a natural language prompt.
 * Sends the prompt and data schema to the backend, which calls Claude to
 * produce a structured pipeline response.
 */
export async function generatePipeline(
  userPrompt: string,
  dataSchema: DataSchema
): Promise<ProposedPipeline> {
  const response = await fetch('/api/generate-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: userPrompt,
      schema: dataSchema,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API request failed with status ${response.status}`);
  }

  const pipeline: ProposedPipeline = await response.json();

  // Validate structure
  if (!pipeline.nodes || !Array.isArray(pipeline.nodes)) {
    throw new Error('Invalid pipeline response: missing nodes array');
  }

  return pipeline;
}

/**
 * Generate a plain-language explanation for a node.
 * Sends node type, config, and row counts to the backend, which calls Claude
 * to produce a human-readable explanation of what the node does.
 */
export async function generateExplanation(params: {
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  inputRowCount?: number;
  outputRowCount?: number;
}): Promise<string> {
  const response = await fetch('/api/explain-node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeType: params.nodeType,
      config: params.nodeConfig,
      inputRowCount: params.inputRowCount,
      outputRowCount: params.outputRowCount,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API request failed with status ${response.status}`);
  }

  const data: { explanation: string } = await response.json();
  return data.explanation;
}
