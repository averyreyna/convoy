import type { DataFrame } from '@/types';
import { generateNodeCode } from '@/lib/codeGenerators';
import { runPythonWithDataFrame } from '@/lib/pythonRunner';
import { executeNodeNative } from '@/lib/nativeExecutors';

export type { FilterConfig } from './filterExecutor';
export type { GroupByConfig } from './groupByExecutor';
export type { SortConfig } from './sortExecutor';
export type { SelectConfig } from './selectExecutor';
export type { TransformConfig } from './transformExecutor';
export type { ComputedColumnConfig } from './computedColumnExecutor';
export type { ReshapeConfig } from './reshapeExecutor';

/** Node types that perform a data transformation (vs. pass-through). */
const TRANSFORM_NODE_TYPES = new Set([
  'filter',
  'groupBy',
  'sort',
  'select',
  'transform',
  'computedColumn',
  'reshape',
]);

/**
 * Execute a node's transformation.
 *
 * Tries the native TypeScript engine first (no serialization, no WASM); for the
 * custom `transform` node and any computedColumn expression the native engine
 * can't parse, falls back to running the generated/custom pandas code in Pyodide.
 */
export async function executeNode(
  nodeType: string,
  input: DataFrame,
  config: Record<string, unknown>,
  customCode?: string
): Promise<DataFrame> {
  if (!TRANSFORM_NODE_TYPES.has(nodeType)) {
    return input;
  }

  // The custom transform node runs arbitrary user pandas, so it never goes native.
  if (nodeType !== 'transform') {
    const native = executeNodeNative(nodeType, input, config);
    if (native) return native;
  }

  const code =
    nodeType === 'transform' && customCode && customCode.trim() !== ''
      ? customCode
      : generateNodeCode(nodeType, config);

  return runPythonWithDataFrame(input, code);
}
