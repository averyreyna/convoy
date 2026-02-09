import type { DataFrame } from '@/types';

export interface SelectConfig {
  columns?: string[];
}

/**
 * Execute a select (column projection) transformation on a DataFrame.
 * Keeps only the specified columns.
 * Returns the input unchanged if the config is incomplete.
 */
export function executeSelect(
  input: DataFrame,
  config: SelectConfig
): DataFrame {
  const { columns } = config;

  // Pass through if not configured or empty
  if (!columns || columns.length === 0) {
    return input;
  }

  // Filter columns
  const outputColumns = input.columns.filter((col) =>
    columns.includes(col.name)
  );

  // Project rows to keep only selected columns
  const outputRows = input.rows.map((row) => {
    const newRow: Record<string, unknown> = {};
    for (const col of columns) {
      if (col in row) {
        newRow[col] = row[col];
      }
    }
    return newRow;
  });

  return {
    columns: outputColumns,
    rows: outputRows,
  };
}
