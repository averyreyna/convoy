import type { DataFrame } from '@/types';

/** Stable key for deduplicating node execution when inputs are unchanged. */
export function buildNodeExecKey(params: {
  config: Record<string, unknown>;
  customCode?: string;
  upstreamVersion: number;
  upstreamData: DataFrame;
  runRequest: number;
}): string {
  const { config, customCode, upstreamVersion, upstreamData, runRequest } = params;
  return JSON.stringify({
    config,
    customCode,
    upstreamVersion,
    inputLen: upstreamData.rows.length,
    inputCols: upstreamData.columns.map((c) => c.name).join(','),
    runRequest,
  });
}

export function buildPassThroughKey(upstreamVersion: number, upstreamData: DataFrame): string {
  return `${upstreamVersion}:${upstreamData.rows.length}:${upstreamData.columns
    .map((c) => c.name)
    .join(',')}`;
}
