import type { DataFrame, Column } from '@/types';

export interface ReshapeConfig {
  keyColumn?: string;
  valueColumn?: string;
  pivotColumns?: string[];
}

/**
 * Execute a reshape (unpivot/melt) transformation on a DataFrame.
 * Converts wide-format data to long-format by unpivoting specified columns
 * into key-value pairs.
 *
 * Example: if data has columns [state, 2020, 2021, 2022] and you pivot
 * [2020, 2021, 2022] with keyColumn="year" and valueColumn="value",
 * you get [state, year, value] with 3x the rows.
 */
export function executeReshape(
  input: DataFrame,
  config: ReshapeConfig
): DataFrame {
  const { keyColumn, valueColumn, pivotColumns } = config;

  // Pass through if not fully configured
  if (!keyColumn || !valueColumn || !pivotColumns || pivotColumns.length === 0) {
    return input;
  }

  // Identify the columns that stay (non-pivot columns)
  const keepColumnNames = input.columns
    .filter((c) => !pivotColumns.includes(c.name))
    .map((c) => c.name);

  // Build new rows
  const newRows: Record<string, unknown>[] = [];
  for (const row of input.rows) {
    const base: Record<string, unknown> = {};
    for (const colName of keepColumnNames) {
      base[colName] = row[colName];
    }

    for (const pivotCol of pivotColumns) {
      newRows.push({
        ...base,
        [keyColumn]: pivotCol,
        [valueColumn]: row[pivotCol],
      });
    }
  }

  // Build new columns
  const keepColumns = input.columns.filter((c) => keepColumnNames.includes(c.name));
  const newColumns: Column[] = [
    ...keepColumns,
    { name: keyColumn, type: 'string' },
    { name: valueColumn, type: 'number' },
  ];

  return {
    columns: newColumns,
    rows: newRows,
  };
}
