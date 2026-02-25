import type { DataFrame, Column } from '@/types';

export interface TransformConfig {
  customCode?: string;
}

/**
 * Validate that a value has the expected DataFrame shape: { columns, rows }.
 * Returns descriptive error messages if the shape is invalid.
 */
function validateDataFrameShape(value: unknown): DataFrame {
  if (!value || typeof value !== 'object') {
    throw new Error(
      'Transform must return an object with `columns` and `rows` arrays.'
    );
  }

  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.rows)) {
    throw new Error(
      'Transform must return an object with a `rows` array. Got: ' +
        typeof obj.rows
    );
  }

  if (!Array.isArray(obj.columns)) {
    throw new Error(
      'Transform must return an object with a `columns` array. Got: ' +
        typeof obj.columns
    );
  }

  // Validate that columns have the right shape
  for (const col of obj.columns) {
    if (!col || typeof col !== 'object' || !('name' in col) || !('type' in col)) {
      throw new Error(
        'Each column must have `name` and `type` properties. Got: ' +
          JSON.stringify(col)
      );
    }
  }

  return {
    columns: obj.columns as Column[],
    rows: obj.rows as Record<string, unknown>[],
  };
}

/**
 * Transform execution is handled by the Python runner (nodeExecutors/index.ts).
 * This file is kept for TransformConfig type and validateDataFrameShape if needed elsewhere.
 */
export function executeTransform(
  _input: DataFrame,
  config: TransformConfig
): DataFrame {
  if (!config.customCode || config.customCode.trim() === '') {
    return _input;
  }
  throw new Error('Transform execution is handled by the Python runner. Use executeNode() instead.');
}
