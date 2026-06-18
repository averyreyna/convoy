/**
 * Native equivalent of generateSelectCode: df = df[[col1, col2, ...]].
 * Projects to the chosen columns in the given order; missing column names are
 * dropped (the config UI only offers existing columns, so this is defensive).
 */

import type { DataFrame } from '@/types';
import type { SelectConfig } from '@/lib/nodeExecutors/selectExecutor';

export function selectNative(input: DataFrame, config: SelectConfig): DataFrame {
  const selected = config.columns;
  if (!selected || selected.length === 0) return input;

  const byName = new Map(input.columns.map((c) => [c.name, c]));
  const columns = selected.filter((name) => byName.has(name)).map((name) => byName.get(name)!);
  const keep = columns.map((c) => c.name);

  const rows = input.rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const name of keep) next[name] = row[name];
    return next;
  });

  return { columns, rows };
}
