import { useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useUpstreamData } from './useUpstreamData';
import { executeNode } from '@/lib/nodeExecutors';
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

/**
 * Hook that manages execution of a transformation node.
 *
 * Automatically executes the node when:
 * - The node is confirmed
 * - Upstream data is available
 * - The node config or custom code changes
 *
 * When customCode is provided it takes priority over config-based execution
 * and is run through the Python runner (Pyodide).
 *
 * Stores the result in the data store and updates row counts on the node.
 */
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

  // Track last execution to avoid redundant re-runs
  const lastExecKey = useRef<string>('');

  const execute = useCallback(async () => {
    if (!upstreamData || !isConfirmed) return;

    // When config is incomplete, pass through upstream data and clear error (no Python run)
    if (!isConfigComplete(nodeType, config, customCode)) {
      setNodeOutput(nodeId, upstreamData);
      updateNode(nodeId, {
        inputRowCount: upstreamData.rows.length,
        outputRowCount: upstreamData.rows.length,
        state: 'confirmed',
        error: undefined,
      });
      return;
    }

    // Create a key from the config + upstream data length + custom code to detect changes
    const execKey = JSON.stringify({
      config,
      customCode,
      inputLen: upstreamData.rows.length,
      inputCols: upstreamData.columns.map((c) => c.name).join(','),
    });

    // Skip if nothing changed
    if (execKey === lastExecKey.current) return;
    lastExecKey.current = execKey;

    try {
      const result: DataFrame = await executeNode(
        nodeType,
        upstreamData,
        config,
        customCode
      );

      // Store the output for downstream nodes
      setNodeOutput(nodeId, result);

      // Update row counts on the node for display
      updateNode(nodeId, {
        inputRowCount: upstreamData.rows.length,
        outputRowCount: result.rows.length,
        state: 'confirmed',
        error: undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      updateNode(nodeId, {
        state: 'error',
        error: message,
      });
    }
  }, [nodeId, nodeType, config, customCode, isConfirmed, upstreamData, setNodeOutput, updateNode]);

  // Auto-execute when dependencies change
  useEffect(() => {
    execute();
  }, [execute]);

  return {
    execute,
    upstreamData,
    isExecuting: false,
    error: null as string | null,
  };
}
