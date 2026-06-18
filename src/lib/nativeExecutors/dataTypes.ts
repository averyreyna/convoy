/**
 * Shared type inference and value-coercion helpers for the native execution
 * engine. These mirror the type model used elsewhere in the app (Papa.parse
 * dynamicTyping + DataSourceNode's inferColumnType) so native output columns
 * carry the same types the Python path would have produced downstream.
 */

import type { Column } from '@/types';

/** Infer a Column type from a single sample value (matches DataSourceNode). */
export function inferColumnType(value: unknown): Column['type'] {
  if (value === null || value === undefined || value === '') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(Date.parse(str))) return 'date';
  return 'string';
}

/**
 * Infer a column type from a set of values by sampling the first non-null one.
 * Used for columns the native engine produces (e.g. melt's value column).
 */
export function inferColumnTypeFromValues(values: unknown[]): Column['type'] {
  for (const v of values) {
    if (v !== null && v !== undefined && v !== '') {
      return inferColumnType(v);
    }
  }
  return 'string';
}

/** True for pandas-style "missing" cells (NaN / null / undefined). */
export function isMissing(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}

/**
 * Coerce a cell to a finite number, or null if it cannot be interpreted as one.
 * Mirrors pandas treating non-numeric cells as non-matching in numeric ops.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
