import type { DataFrame } from '@/types';

export interface SortConfig {
  column?: string;
  direction?: 'asc' | 'desc';
}

/**
 * Execute a sort transformation on a DataFrame.
 * Sorts rows by the specified column and direction.
 * Returns the input unchanged if the config is incomplete.
 */
export function executeSort(
  input: DataFrame,
  config: SortConfig
): DataFrame {
  const { column, direction = 'asc' } = config;

  // Pass through if not configured
  if (!column) {
    return input;
  }

  const sortedRows = [...input.rows].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    // Handle nulls/undefined - push them to the end
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Numeric comparison
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return direction === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // String comparison
    const aStr = String(aVal);
    const bStr = String(bVal);
    const comparison = aStr.localeCompare(bStr);
    return direction === 'asc' ? comparison : -comparison;
  });

  return {
    columns: input.columns,
    rows: sortedRows,
  };
}
