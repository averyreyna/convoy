/**
 * Native equivalent of generateGroupByCode:
 *   df = df.groupby(groupCol)[aggCol].<agg>().reset_index()
 *
 * Mirrors pandas defaults:
 *  - groups are emitted sorted by key ascending (sort=True default);
 *  - the output has two columns: the group key and the aggregated value, which
 *    keeps the aggregate column's name;
 *  - count counts non-null cells; sum/avg operate on numeric cells (non-numeric
 *    ignored, matching numeric coercion); min/max compare numerically for
 *    numeric columns, else lexically.
 */

import type { DataFrame, Column } from '@/types';
import type { GroupByConfig } from '@/lib/nodeExecutors/groupByExecutor';
import { isMissing, toNumber } from './dataTypes';

export function groupByNative(input: DataFrame, config: GroupByConfig): DataFrame {
  const { groupByColumn, aggregation } = config;
  if (!groupByColumn || !aggregation) return input;

  const aggCol = config.aggregateColumn || groupByColumn;
  const aggColType = input.columns.find((c) => c.name === aggCol)?.type;
  const numericAgg = aggregation === 'sum' || aggregation === 'avg';

  // Preserve insertion order of first occurrence, then sort keys ascending.
  const groups = new Map<unknown, unknown[]>();
  for (const row of input.rows) {
    const key = row[groupByColumn];
    const bucket = groups.get(key);
    if (bucket) bucket.push(row[aggCol]);
    else groups.set(key, [row[aggCol]]);
  }

  const keys = [...groups.keys()].sort(compareKeys);

  const rows = keys.map((key) => ({
    [groupByColumn]: key,
    [aggCol]: aggregate(aggregation, groups.get(key)!, aggColType),
  }));

  const groupColType = input.columns.find((c) => c.name === groupByColumn)?.type ?? 'string';
  const resultAggType: Column['type'] =
    aggregation === 'count' || numericAgg ? 'number' : (aggColType ?? 'string');
  const columns: Column[] = [
    { name: groupByColumn, type: groupColType },
    { name: aggCol, type: resultAggType },
  ];

  return { columns, rows };
}

function aggregate(
  aggregation: NonNullable<GroupByConfig['aggregation']>,
  values: unknown[],
  aggColType: Column['type'] | undefined
): unknown {
  if (aggregation === 'count') {
    return values.filter((v) => !isMissing(v)).length;
  }

  if (aggregation === 'sum' || aggregation === 'avg') {
    const nums = values.map(toNumber).filter((n): n is number => n !== null);
    if (nums.length === 0) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return aggregation === 'sum' ? sum : sum / nums.length;
  }

  // min / max
  const present = values.filter((v) => !isMissing(v));
  if (present.length === 0) return null;
  const numeric = aggColType === 'number';
  return present.reduce((best, v) => {
    const cmp = numeric
      ? (toNumber(v) ?? 0) - (toNumber(best) ?? 0)
      : String(v) < String(best) ? -1 : String(v) > String(best) ? 1 : 0;
    if (aggregation === 'max') return cmp > 0 ? v : best;
    return cmp < 0 ? v : best;
  });
}

function compareKeys(a: unknown, b: unknown): number {
  if (isMissing(a) && isMissing(b)) return 0;
  if (isMissing(a)) return 1;
  if (isMissing(b)) return -1;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na - nb;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
