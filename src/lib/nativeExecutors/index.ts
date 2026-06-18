/**
 * Native (TypeScript) execution engine for structured transform nodes.
 *
 * These operate directly on the in-memory DataFrame, avoiding the JSON round-trip
 * and WASM-pandas cost of the Pyodide path. Semantics are kept in lock-step with
 * the pandas code in `@/lib/codeGenerators` so the in-app preview matches the
 * exported script. Node types not handled here (e.g. custom `transform`, and —
 * until Phase 3 — `computedColumn`) fall back to the Pyodide runner.
 */

import type { DataFrame } from '@/types';
import { filterNative } from './filter';
import { sortNative } from './sort';
import { selectNative } from './select';
import { groupByNative } from './groupBy';
import { reshapeNative } from './reshape';
import { computedColumnNative } from './computedColumn';

/**
 * Node types the native engine always handles without Python, so the UI can use
 * the fast (near-instant) recompute path. `computedColumn` is intentionally
 * excluded: it is native only when its expression parses, falls back to Python
 * otherwise, and is free-text input that benefits from the standard debounce.
 */
export const NATIVE_NODE_TYPES = new Set(['filter', 'sort', 'select', 'groupBy', 'reshape']);

export function isNativelySupported(nodeType: string): boolean {
  return NATIVE_NODE_TYPES.has(nodeType);
}

/**
 * Execute a node natively. Returns the resulting DataFrame, or null when the node
 * type (or, for computedColumn, the specific expression) is not handled natively,
 * in which case the caller should fall back to the Python runner.
 */
export function executeNodeNative(
  nodeType: string,
  input: DataFrame,
  config: Record<string, unknown>
): DataFrame | null {
  switch (nodeType) {
    case 'filter':
      return filterNative(input, config);
    case 'sort':
      return sortNative(input, config);
    case 'select':
      return selectNative(input, config);
    case 'groupBy':
      return groupByNative(input, config);
    case 'reshape':
      return reshapeNative(input, config);
    case 'computedColumn':
      return computedColumnNative(input, config);
    default:
      return null;
  }
}
