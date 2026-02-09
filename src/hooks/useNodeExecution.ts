import { useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useUpstreamData } from './useUpstreamData';
import { executeNode } from '@/lib/nodeExecutors';
import type { DataFrame } from '@/types';

/**
 * Hook that manages execution of a transformation node.
 *
 * Automatically executes the node when:
 * - The node is confirmed
 * - Upstream data is available
 * - The node config or custom code changes
 *
 * When customCode is provided it takes priority over config-based execution
 * and is run through the sandboxed Function executor.
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

  const execute = useCallback(() => {
    if (!upstreamData || !isConfirmed) return;

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
      const result: DataFrame = executeNode(
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
