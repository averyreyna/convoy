import type { DataFrame } from '@/types';

export interface FilterConfig {
  column?: string;
  operator?: string;
  value?: string;
}

/**
 * Execute a filter transformation on a DataFrame.
 * Filters rows based on the specified column, operator, and value.
 * Returns the input unchanged if the config is incomplete.
 */
export function executeFilter(
  input: DataFrame,
  config: FilterConfig
): DataFrame {
  const { column, operator, value } = config;

  // Pass through if not fully configured
  if (!column || !operator || value === undefined || value === '') {
    return input;
  }

  const filteredRows = input.rows.filter((row) => {
    const cellValue = row[column];

    switch (operator) {
      case 'eq':
        // eslint-disable-next-line eqeqeq
        return cellValue == value;
      case 'neq':
        // eslint-disable-next-line eqeqeq
        return cellValue != value;
      case 'gt':
        return Number(cellValue) > Number(value);
      case 'lt':
        return Number(cellValue) < Number(value);
      case 'contains':
        return String(cellValue ?? '')
          .toLowerCase()
          .includes(String(value).toLowerCase());
      case 'startsWith':
        return String(cellValue ?? '')
          .toLowerCase()
          .startsWith(String(value).toLowerCase());
      default:
        return true;
    }
  });

  return {
    columns: input.columns,
    rows: filteredRows,
  };
}
