/**
 * API client for Convoy.
 * Communicates with the Express backend that wraps the Anthropic Claude API.
 */

import type {
  ImportFromPythonResponse,
  EditNodesSchema,
  EditNodesPipelineContext,
  EditNodesResponse,
  SuggestedPipelineNode,
} from '@/types';

export type { EditNodesSchema, EditNodesPipelineContext, EditNodesResponse, SuggestedPipelineNode };

/**
 * Import a pipeline from Python (pandas) source. Powers run-reconciliation:
 * after a script executes, the resulting code is parsed back into typed nodes.
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
 * Base URL for API requests. Use relative URLs (empty string) so the app works
 * with the Vite proxy in dev and same-origin in production. Override with
 * VITE_API_URL only when you need to point at a different API host.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string) || '';

function buildApiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
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

  const url = buildApiUrl('/api/edit-nodes');
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
  const url = buildApiUrl('/api/render-chart');
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

/**
 * Generate Python code to clean/filter data from a natural language instruction.
 * Sends schema and optional sample rows; returns code that runs in-browser with the upstream DataFrame.
 */
export async function cleanDataWithAi(params: {
  instruction: string;
  schema: EditNodesSchema;
  sampleRows?: Record<string, unknown>[];
}): Promise<{ code: string }> {
  const { instruction, schema, sampleRows } = params;
  const url = buildApiUrl('/api/clean-data');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, schema, sampleRows }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message: string;
    try {
      const body = JSON.parse(text) as { error?: string };
      message = body.error || `Clean data failed (${response.status})`;
    } catch {
      message = text
        ? `Clean data failed (${response.status}). ${text.slice(0, 200)}`
        : `Clean data failed (${response.status}). No details from server.`;
    }
    throw new Error(message);
  }

  const data = (await response.json()) as { code?: string };
  if (typeof data.code !== 'string') {
    throw new Error('Invalid clean-data response: missing code');
  }
  return { code: data.code };
}
