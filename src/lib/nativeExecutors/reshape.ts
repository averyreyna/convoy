/**
 * Native equivalent of generateReshapeCode:
 *   df = pd.melt(df, id_vars=[non-pivot cols], value_vars=[pivotColumns],
 *                var_name=keyColumn, value_name=valueColumn)
 *
 * Mirrors pandas melt output order: it iterates value_vars in order and, within
 * each, the original rows — i.e. all rows for pivot[0], then pivot[1], etc.
 * Output columns are [id_vars..., keyColumn, valueColumn].
 */

import type { DataFrame, Column } from '@/types';
import type { ReshapeConfig } from '@/lib/nodeExecutors/reshapeExecutor';
import { inferColumnTypeFromValues } from './dataTypes';

export function reshapeNative(input: DataFrame, config: ReshapeConfig): DataFrame {
  const { keyColumn, valueColumn, pivotColumns } = config;
  if (!keyColumn || !valueColumn || !pivotColumns || pivotColumns.length === 0) {
    return input;
  }

  const pivotSet = new Set(pivotColumns);
  const idColumns = input.columns.filter((c) => !pivotSet.has(c.name));
  const idNames = idColumns.map((c) => c.name);

  const rows: Record<string, unknown>[] = [];
  for (const pivot of pivotColumns) {
    for (const row of input.rows) {
      const next: Record<string, unknown> = {};
      for (const name of idNames) next[name] = row[name];
      next[keyColumn] = pivot;
      next[valueColumn] = row[pivot];
      rows.push(next);
    }
  }

  const columns: Column[] = [
    ...idColumns,
    { name: keyColumn, type: 'string' },
    { name: valueColumn, type: inferColumnTypeFromValues(rows.map((r) => r[valueColumn])) },
  ];

  return { columns, rows };
}
