import { useEffect, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';
import { useUpstreamData } from './useUpstreamData';
import { runPythonWithDataFrame } from '@/lib/pythonRunner';
import type { DataFrame } from '@/types';

/**
 * Hook for the aiCleanData node. Runs stored generatedCode with upstream data
 * when the node is confirmed; does not call the API (Clean/Regenerate button does that).
 * Re-runs when upstream data or generatedCode changes.
 */
export function useAiCleanDataExecution(
  nodeId: string,
  generatedCode: string | undefined,
  isConfirmed: boolean
) {
  const upstreamData = useUpstreamData(nodeId);
  const setNodeOutput = useDataStore((s) => s.setNodeOutput);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const pipelineRunInProgress = useCanvasStore((s) => s.pipelineRunInProgress);
  const lastExecKey = useRef<string>('');

  useEffect(() => {
    if (!upstreamData || !isConfirmed || !generatedCode?.trim()) return;
    if (pipelineRunInProgress) return;

    const execKey = JSON.stringify({
      generatedCode,
      inputLen: upstreamData.rows.length,
      inputCols: upstreamData.columns.map((c) => c.name).join(','),
    });
    if (execKey === lastExecKey.current) return;
    lastExecKey.current = execKey;

    let cancelled = false;

    (async () => {
      try {
        const result: DataFrame = await runPythonWithDataFrame(upstreamData, generatedCode);
        if (cancelled) return;
        setNodeOutput(nodeId, result);
        updateNode(nodeId, {
          inputRowCount: upstreamData.rows.length,
          outputRowCount: result.rows.length,
          state: 'confirmed',
          error: undefined,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Execution failed';
        updateNode(nodeId, {
          state: 'error',
          error: message,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    nodeId,
    generatedCode,
    isConfirmed,
    upstreamData,
    pipelineRunInProgress,
    setNodeOutput,
    updateNode,
  ]);

  return { upstreamData };
}
