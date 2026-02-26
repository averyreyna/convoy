import type { DataFrame } from '@/types';
import { generateNodeCode } from '@/lib/codeGenerators';
import { runPythonWithDataFrame } from '@/lib/pythonRunner';

export type { FilterConfig } from './filterExecutor';
export type { GroupByConfig } from './groupByExecutor';
export type { SortConfig } from './sortExecutor';
export type { SelectConfig } from './selectExecutor';
export type { TransformConfig } from './transformExecutor';
export type { ComputedColumnConfig } from './computedColumnExecutor';
export type { ReshapeConfig } from './reshapeExecutor';

/** Node types that perform a transformation and run through Python */
const PYTHON_NODE_TYPES = new Set([
  'filter',
  'groupBy',
  'sort',
  'select',
  'transform',
  'computedColumn',
  'reshape',
]);

/**
 * Execute a node's transformation via in-browser Python (Pyodide).
 * Generates or uses custom Python code, runs it with the input dataframe as `df`, returns the result.
 */
export async function executeNode(
  nodeType: string,
  input: DataFrame,
  config: Record<string, unknown>,
  customCode?: string
): Promise<DataFrame> {
  if (!PYTHON_NODE_TYPES.has(nodeType)) {
    return input;
  }

  const code =
    nodeType === 'transform' && customCode && customCode.trim() !== ''
      ? customCode
      : generateNodeCode(nodeType, config);

  return runPythonWithDataFrame(input, code);
}
