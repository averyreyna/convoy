/**
 * Native equivalent of generateSortCode: df = df.sort_values(col, ascending=...).
 *
 * Mirrors pandas defaults: missing values sort last regardless of direction
 * (na_position='last'). Numeric columns compare numerically, others lexically.
 * Uses a stable sort; pandas' default quicksort is not stable, so the relative
 * order of equal keys may differ, but the multiset of rows is identical.
 */

import type { DataFrame } from '@/types';
import type { SortConfig } from '@/lib/nodeExecutors/sortExecutor';
import { isMissing, toNumber } from './dataTypes';

function compare<T extends number | string>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortNative(input: DataFrame, config: SortConfig): DataFrame {
  const { column } = config;
  if (!column) return input;

  const dir = config.direction === 'desc' ? -1 : 1;
  const isNumericCol = input.columns.find((c) => c.name === column)?.type === 'number';

  const rows = [...input.rows].sort((ra, rb) => {
    const a = ra[column];
    const b = rb[column];
    if (isMissing(a) && isMissing(b)) return 0;
    if (isMissing(a)) return 1; // missing always last
    if (isMissing(b)) return -1;

    if (isNumericCol) return compare(toNumber(a) ?? 0, toNumber(b) ?? 0) * dir;
    return compare(String(a), String(b)) * dir;
  });

  return { columns: input.columns, rows };
}
