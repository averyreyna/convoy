import { useEffect, useCallback, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useUpstreamData } from './useUpstreamData';
import { executeNode } from '@/lib/nodeExecutors';
import { isNativelySupported } from '@/lib/nativeExecutors';
import type { DataFrame } from '@/types';

/**
 * Returns true when config (and optional customCode) is complete enough to run the node.
 * Incomplete configs cause pass-through instead of running Python.
 */
function isConfigComplete(
  nodeType: string,
  config: Record<string, unknown>,
  customCode?: string
): boolean {
  switch (nodeType) {
    case 'filter': {
      const { column, operator, value } = config;
      if (!column || !operator) return false;
      const valueStr =
        value !== undefined && value !== null ? String(value).trim() : '';
      const needValue = ['eq', 'neq', 'gt', 'lt', 'contains', 'startsWith'].includes(
        operator as string
      );
      return !needValue || valueStr !== '';
    }
    case 'groupBy': {
      const { groupByColumn, aggregation } = config;
      return !!(groupByColumn && aggregation);
    }
    case 'sort':
      return !!config.column;
    case 'select': {
      const cols = config.columns as string[] | undefined;
      return Array.isArray(cols) && cols.length > 0;
    }
    case 'transform':
      return !!(
        customCode &&
        typeof customCode === 'string' &&
        customCode.trim() !== ''
      );
    case 'computedColumn': {
      const { newColumnName, expression } = config;
      return !!(
        newColumnName &&
        expression &&
        String(expression).trim() !== ''
      );
    }
    case 'reshape': {
      const { keyColumn, valueColumn, pivotColumns } = config as {
        keyColumn?: string;
        valueColumn?: string;
        pivotColumns?: string[];
      };
      return !!(
        keyColumn &&
        valueColumn &&
        Array.isArray(pivotColumns) &&
        pivotColumns.length > 0
      );
    }
    default:
      return true;
  }
}

const DEBOUNCE_MS = 400;
// Native nodes execute synchronously and skip the Pyodide queue, so they only
// need a short window to coalesce rapid edits rather than the full Python debounce.
const NATIVE_DEBOUNCE_MS = 80;

// hook that manages execution of a transformation node
// uses cancellation and run id so only the latest run updates the store
// stale completions are ignored when the user edits again.
export function useNodeExecution(
  nodeId: string,
  nodeType: string,
  config: Record<string, unknown>,
  isConfirmed: boolean,
  customCode?: string
) {
  const upstreamData = useUpstreamData(nodeId);
  const setNodeOutput = useDataStore((s) => s.setNodeOutput);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const markChildrenStale = useCanvasStore((s) => s.markChildrenStale);
  const clearChildrenStale = useCanvasStore((s) => s.clearChildrenStale);
  const clearNodeStale = useCanvasStore((s) => s.clearNodeStale);
  const pipelineRunInProgress = useCanvasStore((s) => s.pipelineRunInProgress);
  const executionDebounceBypassUntil = useCanvasStore((s) => s.executionDebounceBypassUntil);

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastExecKey = useRef<string>('');
  const lastPassThroughKey = useRef<string>('');
  const runIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [runRequest, setRunRequest] = useState(0);

  const nodeIdRef = useRef(nodeId);
  const nodeTypeRef = useRef(nodeType);
  const configRef = useRef(config);
  const customCodeRef = useRef(customCode);
  const isConfirmedRef = useRef(isConfirmed);
  const upstreamDataRef = useRef(upstreamData);
  nodeIdRef.current = nodeId;
  nodeTypeRef.current = nodeType;
  configRef.current = config;
  customCodeRef.current = customCode;
  isConfirmedRef.current = isConfirmed;
  upstreamDataRef.current = upstreamData;

  const execute = useCallback(() => {
    setRunRequest((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!upstreamData || !isConfirmed) return;
    if (pipelineRunInProgress) return;

    // when config is incomplete, pass through upstream data and clear error (no Python run)
    if (!isConfigComplete(nodeType, config, customCode)) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Only write to the stores when the pass-through result would actually
      // change. Writing unconditionally here re-renders the node, and if any
      // input dependency is an unstable reference the effect would re-run and
      // loop ("Maximum update depth exceeded").
      const passKey = `${upstreamData.rows.length}:${upstreamData.columns
        .map((c) => c.name)
        .join(',')}`;
      if (passKey !== lastPassThroughKey.current) {
        lastPassThroughKey.current = passKey;
        setNodeOutput(nodeId, upstreamData);
        updateNode(nodeId, {
          inputRowCount: upstreamData.rows.length,
          outputRowCount: upstreamData.rows.length,
          state: 'confirmed',
          error: undefined,
        });
        // Output just changed (forwarded upstream), so downstream is now stale.
        clearNodeStale(nodeId);
        markChildrenStale(nodeId);
      }
      setError(null);
      return;
    }

    // Reaching the execution path means config is complete; clear the
    // pass-through key so a later return to an incomplete config re-writes.
    lastPassThroughKey.current = '';

    const execKey = JSON.stringify({
      config,
      customCode,
      inputLen: upstreamData.rows.length,
      inputCols: upstreamData.columns.map((c) => c.name).join(','),
      runRequest,
    });

    if (execKey === lastExecKey.current) {
      // Inputs are unchanged, so this node won't recompute and its current
      // output is still valid — clear any stale mark a parent left on it.
      clearNodeStale(nodeId);
      return;
    }
    lastExecKey.current = execKey;

    const baseDebounce = isNativelySupported(nodeType) ? NATIVE_DEBOUNCE_MS : DEBOUNCE_MS;
    const debounceMs = executionDebounceBypassUntil > Date.now() ? 0 : baseDebounce;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const nid = nodeIdRef.current;
      const ntype = nodeTypeRef.current;
      const cfg = configRef.current;
      const code = customCodeRef.current;
      const up = upstreamDataRef.current;
      if (!up || !isConfirmedRef.current || useCanvasStore.getState().pipelineRunInProgress) return;

      runIdRef.current += 1;
      const thisRunId = runIdRef.current;

      setIsExecuting(true);
      setError(null);

      updateNode(nid, {
        state: 'running',
        error: undefined,
      });

      // This node is recomputing, so it's no longer stale; its output is about
      // to change, so light up the immediate downstream as stale (the wavefront).
      clearNodeStale(nid);
      markChildrenStale(nid);

      (async () => {
        try {
          const result: DataFrame = await executeNode(ntype, up, cfg, code);

          if (thisRunId !== runIdRef.current) return;

          setNodeOutput(nid, result);
          updateNode(nid, {
            inputRowCount: up.rows.length,
            outputRowCount: result.rows.length,
            state: 'confirmed',
            error: undefined,
          });
          setError(null);
        } catch (err) {
          if (thisRunId !== runIdRef.current) return;

          const message = err instanceof Error ? err.message : 'Execution failed';
          setError(message);
          updateNode(nid, {
            state: 'error',
            error: message,
          });
          // Output didn't change on failure, so downstream isn't actually
          // invalidated — undo the optimistic stale mark from run start.
          clearChildrenStale(nid);
        } finally {
          if (thisRunId === runIdRef.current) {
            setIsExecuting(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Intentionally do not reset lastExecKey here so we don't
      // re-run execution on harmless re-renders with the same inputs.
    };
  }, [
    nodeId,
    nodeType,
    config,
    customCode,
    isConfirmed,
    upstreamData,
    runRequest,
    pipelineRunInProgress,
    executionDebounceBypassUntil,
    setNodeOutput,
    updateNode,
    markChildrenStale,
    clearChildrenStale,
    clearNodeStale,
  ]);

  return {
    execute,
    upstreamData,
    isExecuting,
    error,
  };
}
