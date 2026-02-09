import type { DataFrame } from '@/types';
import { executeFilter, type FilterConfig } from './filterExecutor';
import { executeGroupBy, type GroupByConfig } from './groupByExecutor';
import { executeSort, type SortConfig } from './sortExecutor';
import { executeSelect, type SelectConfig } from './selectExecutor';
import { executeTransform, type TransformConfig } from './transformExecutor';
import { executeComputedColumn, type ComputedColumnConfig } from './computedColumnExecutor';
import { executeReshape, type ReshapeConfig } from './reshapeExecutor';

export { executeFilter } from './filterExecutor';
export { executeGroupBy } from './groupByExecutor';
export { executeSort } from './sortExecutor';
export { executeSelect } from './selectExecutor';
export { executeTransform } from './transformExecutor';
export { executeComputedColumn } from './computedColumnExecutor';
export { executeReshape } from './reshapeExecutor';

export type { FilterConfig } from './filterExecutor';
export type { GroupByConfig } from './groupByExecutor';
export type { SortConfig } from './sortExecutor';
export type { SelectConfig } from './selectExecutor';
export type { TransformConfig } from './transformExecutor';
export type { ComputedColumnConfig } from './computedColumnExecutor';
export type { ReshapeConfig } from './reshapeExecutor';

/**
 * Execute a node's transformation given its type, input data, config,
 * and optional custom code.
 *
 * When customCode is provided, it takes priority over config-based execution
 * and runs through the sandboxed Function executor.
 *
 * Returns the transformed DataFrame or throws an error.
 */
export function executeNode(
  nodeType: string,
  input: DataFrame,
  config: Record<string, unknown>,
  customCode?: string
): DataFrame {
  // If the user has written custom code, run it through the transform executor
  // regardless of node type (except chart/dataSource which don't execute)
  if (customCode) {
    return executeTransform(input, { customCode });
  }

  switch (nodeType) {
    case 'filter':
      return executeFilter(input, config as FilterConfig);
    case 'groupBy':
      return executeGroupBy(input, config as GroupByConfig);
    case 'sort':
      return executeSort(input, config as SortConfig);
    case 'select':
      return executeSelect(input, config as SelectConfig);
    case 'transform':
      return executeTransform(input, config as TransformConfig);
    case 'computedColumn':
      return executeComputedColumn(input, config as ComputedColumnConfig);
    case 'reshape':
      return executeReshape(input, config as ReshapeConfig);
    default:
      // For unknown node types, pass through
      return input;
  }
}
