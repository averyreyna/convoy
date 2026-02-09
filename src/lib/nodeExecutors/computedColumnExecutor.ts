import type { DataFrame, Column } from '@/types';

export interface ComputedColumnConfig {
  newColumnName?: string;
  expression?: string;
}

/**
 * Execute a computed column transformation on a DataFrame.
 * Adds a new column derived from a JavaScript expression applied to each row.
 * The expression receives the row as `d`, e.g. `d.population / d.area`.
 */
export function executeComputedColumn(
  input: DataFrame,
  config: ComputedColumnConfig
): DataFrame {
  const { newColumnName, expression } = config;

  // Pass through if not fully configured
  if (!newColumnName || !expression) {
    return input;
  }

  // Build a function from the expression
  // The expression receives `d` (the row object)
  let computeFn: (d: Record<string, unknown>) => unknown;
  try {
    computeFn = new Function('d', `return (${expression})`) as (
      d: Record<string, unknown>
    ) => unknown;
  } catch (err) {
    throw new Error(`Invalid expression: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Apply the expression to each row
  const newRows = input.rows.map((row) => {
    try {
      const value = computeFn(row);
      return { ...row, [newColumnName]: value };
    } catch {
      return { ...row, [newColumnName]: null };
    }
  });

  // Detect the type of the new column from the first non-null value
  const firstValue = newRows.find((r) => r[newColumnName] != null)?.[newColumnName];
  const newColType: Column['type'] =
    typeof firstValue === 'number' ? 'number' :
    typeof firstValue === 'boolean' ? 'boolean' : 'string';

  const newColumns: Column[] = [
    ...input.columns,
    { name: newColumnName, type: newColType },
  ];

  return {
    columns: newColumns,
    rows: newRows,
  };
}
