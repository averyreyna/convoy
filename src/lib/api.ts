/**
 * API client for Convoy.
 * Communicates with the Express backend that wraps the Anthropic Claude API.
 */

import type {
  ProposedPipeline,
  ImportFromPythonResponse,
  EditNodesSchema,
  EditNodesPipelineContext,
  EditNodesResponse,
  SuggestedPipelineNode,
  AnswerAboutNodesResponse,
} from '@/types';

export type { EditNodesSchema, EditNodesPipelineContext, EditNodesResponse, SuggestedPipelineNode, AnswerAboutNodesResponse };

/**
 * Base URL for API requests. Use relative URLs (empty string) so the app works
 * with the Vite proxy in dev and same-origin in production. Override with
 * VITE_API_URL only when you need to point at a different API host.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string) || '';

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

/**
 * Import a pipeline from Python (pandas) source.
 * Server uses AST extraction first, then LLM fallback for complex scripts.
 */
export async function importPipelineFromPython(
  source: string
): Promise<ImportFromPythonResponse> {
  const response = await fetch('/api/import-from-python', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Import failed with status ${response.status}`);
  }

  const data: ImportFromPythonResponse = await response.json();

  if (!data.pipeline?.nodes || !Array.isArray(data.pipeline.nodes)) {
    throw new Error('Invalid import response: missing pipeline.nodes');
  }

  if (!data.pipeline.explanation) {
    data.pipeline.explanation = 'Imported from Python script';
  }

  return data;
}

/**
 * Edit selected nodes with AI. Sends selected node IDs, prompt, optional schema and pipeline context.
 * Returns a suggested pipeline fragment (ordered nodes) that replaces the selection. Callers should
 * check suggestedPipeline?.nodes?.length before applying; empty or missing means no suggestion.
 */
export async function editNodes(params: {
  nodeIds: string[];
  prompt: string;
  schema?: EditNodesSchema;
  pipelineContext?: EditNodesPipelineContext;
}): Promise<EditNodesResponse> {
  const { nodeIds, prompt, schema, pipelineContext } = params;

  const url = `${API_BASE || ''}/api/edit-nodes`.replace(/\/+/, '/');
  if (import.meta.env.DEV) {
    console.log('[editNodes] Request', { url: url || '(relative)', nodeIds, promptLength: prompt.length });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeIds,
      prompt,
      ...(schema && { schema }),
      ...(pipelineContext && { pipelineContext }),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message: string;
    try {
      const body = JSON.parse(text) as { error?: string };
      message = body.error || `Edit nodes failed (${response.status})`;
    } catch {
      message = text
        ? `Edit nodes failed (${response.status}). ${text.slice(0, 200)}`
        : `Edit nodes failed (${response.status}). No details from server.`;
    }
    if (import.meta.env.DEV) {
      console.error('[editNodes] Request failed', response.status, message);
    }
    throw new Error(message);
  }

  const data: EditNodesResponse = await response.json();
  const nodeCount = data.suggestedPipeline?.nodes?.length ?? 0;
  if (import.meta.env.DEV) {
    console.log('[editNodes] Response', nodeCount === 0 ? 'empty suggestedPipeline' : { suggestedNodeCount: nodeCount });
  }
  return data;
}

/**
 * Get advice about connected nodes. Sends node IDs, question, optional schema and pipeline context.
 * Returns a text answer (advice, next steps, feedback). No pipeline edits.
 */
export async function answerAboutNodes(params: {
  nodeIds: string[];
  question: string;
  schema?: EditNodesSchema;
  pipelineContext?: EditNodesPipelineContext;
}): Promise<AnswerAboutNodesResponse> {
  const { nodeIds, question, schema, pipelineContext } = params;

  const url = `${API_BASE || ''}/api/answer-about-nodes`.replace(/\/+/, '/');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeIds,
      question,
      ...(schema && { schema }),
      ...(pipelineContext && { pipelineContext }),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message: string;
    try {
      const body = JSON.parse(text) as { error?: string };
      message = body.error || `Answer about nodes failed (${response.status})`;
    } catch {
      message = text
        ? `Answer about nodes failed (${response.status}). ${text.slice(0, 200)}`
        : `Answer about nodes failed (${response.status}). No details from server.`;
    }
    throw new Error(message);
  }

  const data: AnswerAboutNodesResponse = await response.json();
  return data;
}

/**
 * Render a chart on the backend with Python/matplotlib.
 * Returns base64 data URL (PNG) or raw SVG string.
 */
export async function renderChart(params: {
  chartType: string;
  xAxis: string;
  yAxis: string;
  colorBy?: string;
  data: Record<string, unknown>[];
  width?: number;
  height?: number;
  format?: 'png' | 'svg';
}): Promise<{ image: string }> {
  const url = `${API_BASE || ''}/api/render-chart`.replace(/\/+/, '/');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chartType: params.chartType,
      xAxis: params.xAxis,
      yAxis: params.yAxis,
      colorBy: params.colorBy,
      data: params.data,
      width: params.width,
      height: params.height,
      format: params.format ?? 'png',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as { error?: string }).error || `Chart render failed (${response.status})`);
  }

  const data = (await response.json()) as { image: string };
  if (typeof data.image !== 'string') {
    throw new Error('Invalid chart response: missing image');
  }
  return data;
}
