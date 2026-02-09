import type { DataFrame, Column } from '@/types';

export interface GroupByConfig {
  groupByColumn?: string;
  aggregateColumn?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

/**
 * Execute a group-by aggregation on a DataFrame.
 * Groups rows by the specified column and applies the aggregation function.
 * Returns the input unchanged if the config is incomplete.
 */
export function executeGroupBy(
  input: DataFrame,
  config: GroupByConfig
): DataFrame {
  const { groupByColumn, aggregateColumn, aggregation } = config;

  // Pass through if not fully configured
  if (!groupByColumn || !aggregation) {
    return input;
  }

  // For 'count', we don't need an aggregate column
  if (aggregation !== 'count' && !aggregateColumn) {
    return input;
  }

  // Group rows by the specified column
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const row of input.rows) {
    const key = String(row[groupByColumn] ?? '');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  // Compute aggregation for each group
  const resultRows: Record<string, unknown>[] = [];

  for (const [key, groupRows] of groups) {
    const resultRow: Record<string, unknown> = {
      [groupByColumn]: key,
    };

    const aggLabel = aggregation === 'count'
      ? 'count'
      : `${aggregation}_${aggregateColumn}`;

    switch (aggregation) {
      case 'count':
        resultRow[aggLabel] = groupRows.length;
        break;
      case 'sum': {
        const sum = groupRows.reduce(
          (acc, row) => acc + (Number(row[aggregateColumn!]) || 0),
          0
        );
        resultRow[aggLabel] = sum;
        break;
      }
      case 'avg': {
        const values = groupRows
          .map((row) => Number(row[aggregateColumn!]))
          .filter((v) => !isNaN(v));
        resultRow[aggLabel] = values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
        break;
      }
      case 'min': {
        const nums = groupRows
          .map((row) => Number(row[aggregateColumn!]))
          .filter((v) => !isNaN(v));
        resultRow[aggLabel] = nums.length > 0 ? Math.min(...nums) : 0;
        break;
      }
      case 'max': {
        const nums = groupRows
          .map((row) => Number(row[aggregateColumn!]))
          .filter((v) => !isNaN(v));
        resultRow[aggLabel] = nums.length > 0 ? Math.max(...nums) : 0;
        break;
      }
    }

    resultRows.push(resultRow);
  }

  // Build output columns
  const aggColumnName = aggregation === 'count'
    ? 'count'
    : `${aggregation}_${aggregateColumn}`;

  const outputColumns: Column[] = [
    {
      name: groupByColumn,
      type: input.columns.find((c) => c.name === groupByColumn)?.type || 'string',
    },
    {
      name: aggColumnName,
      type: 'number',
    },
  ];

  return {
    columns: outputColumns,
    rows: resultRows,
  };
}
