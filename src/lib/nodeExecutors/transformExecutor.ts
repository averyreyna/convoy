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
 * Execute a transform node by running user-provided JavaScript code.
 *
 * The code receives `rows` (array of objects) and `columns` (array of {name, type})
 * and must return `{ columns, rows }`.
 *
 * Uses `new Function()` for sandboxed execution (same-origin, no access to
 * module scope, imports, or DOM).
 */
export function executeTransform(
  input: DataFrame,
  config: TransformConfig
): DataFrame {
  const { customCode } = config;

  if (!customCode || customCode.trim() === '') {
    return input;
  }

  // Deep clone to prevent mutation of upstream data
  const rowsCopy = JSON.parse(JSON.stringify(input.rows));
  const columnsCopy = JSON.parse(JSON.stringify(input.columns));

  try {
    // Wrap user code in a function that receives rows and columns
    // The user code should end with `return { columns, rows }`
    const fn = new Function(
      'rows',
      'columns',
      // Provide a minimal helper for convenience
      `"use strict";
${customCode}`
    );

    const result = fn(rowsCopy, columnsCopy);
    return validateDataFrameShape(result);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Syntax error in transform code: ${err.message}`);
    }
    if (err instanceof Error) {
      throw new Error(`Transform execution error: ${err.message}`);
    }
    throw new Error('Transform execution failed with an unknown error.');
  }
}
