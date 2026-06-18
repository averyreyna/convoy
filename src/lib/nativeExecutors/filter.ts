/**
 * Native equivalent of generateFilterCode: df = df[df[col] <op> value].
 *
 * Semantics mirror the generated pandas exactly:
 *  - value is treated as numeric when it parses as a finite number (matches the
 *    `isNumeric` branch in codeGenerators), otherwise as a string literal.
 *  - contains: case-insensitive substring, missing cells excluded (na=False).
 *  - startsWith: case-sensitive prefix, missing cells excluded (na=False).
 *  - eq/neq/gt/lt: numeric comparison when value is numeric, else lexical.
 */

import type { DataFrame } from '@/types';
import type { FilterConfig } from '@/lib/nodeExecutors/filterExecutor';
import { isMissing, toNumber } from './dataTypes';

const NEEDS_VALUE = new Set(['eq', 'neq', 'gt', 'lt', 'contains', 'startsWith']);

export function filterNative(input: DataFrame, config: FilterConfig): DataFrame {
  const { column, operator } = config;
  const valueStr =
    config.value !== undefined && config.value !== null ? String(config.value).trim() : '';

  // Incomplete config → pass through (matches isConfigComplete gating).
  if (!column || !operator) return input;
  if (NEEDS_VALUE.has(operator) && valueStr === '') return input;

  const numValue = Number(valueStr);
  const isNumeric = valueStr !== '' && !Number.isNaN(numValue);

  const predicate = makePredicate(operator, valueStr, numValue, isNumeric);
  const rows = input.rows.filter((row) => predicate(row[column]));
  return { columns: input.columns, rows };
}

function makePredicate(
  operator: string,
  valueStr: string,
  numValue: number,
  isNumeric: boolean
): (cell: unknown) => boolean {
  switch (operator) {
    case 'contains': {
      const needle = valueStr.toLowerCase();
      return (cell) => !isMissing(cell) && String(cell).toLowerCase().includes(needle);
    }
    case 'startsWith':
      return (cell) => !isMissing(cell) && String(cell).startsWith(valueStr);
    case 'eq':
      return isNumeric
        ? (cell) => toNumber(cell) === numValue
        : (cell) => !isMissing(cell) && String(cell) === valueStr;
    case 'neq':
      return isNumeric
        ? (cell) => toNumber(cell) !== numValue
        : (cell) => isMissing(cell) || String(cell) !== valueStr;
    case 'gt':
      return isNumeric
        ? (cell) => { const n = toNumber(cell); return n !== null && n > numValue; }
        : (cell) => !isMissing(cell) && String(cell) > valueStr;
    case 'lt':
      return isNumeric
        ? (cell) => { const n = toNumber(cell); return n !== null && n < numValue; }
        : (cell) => !isMissing(cell) && String(cell) < valueStr;
    default:
      return () => true;
  }
}
