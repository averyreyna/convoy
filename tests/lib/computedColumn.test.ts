import { describe, it, expect } from 'vitest';
import type { DataFrame } from '@/types';
import { computedColumnNative } from '@/lib/nativeExecutors/computedColumn';

/**
 * Native computed-column evaluation must match `df["new"] = <expression>`
 * semantics for the supported subset, and return null (→ Pyodide fallback) for
 * anything outside it.
 */

const df: DataFrame = {
  columns: [
    { name: 'a', type: 'number' },
    { name: 'b', type: 'number' },
    { name: 'first', type: 'string' },
    { name: 'last', type: 'string' },
  ],
  rows: [
    { a: 2, b: 3, first: 'Ada', last: 'Lovelace' },
    { a: 10, b: 4, first: 'Alan', last: 'Turing' },
  ],
};

function values(out: DataFrame | null, col: string): unknown[] {
  if (!out) throw new Error('expected a native result');
  return out.rows.map((r) => r[col]);
}

describe('computedColumnNative — supported expressions', () => {
  it('adds two numeric columns', () => {
    const out = computedColumnNative(df, { newColumnName: 'sum', expression: 'df["a"] + df["b"]' });
    expect(values(out, 'sum')).toEqual([5, 14]);
    expect(out!.columns.find((c) => c.name === 'sum')?.type).toBe('number');
  });

  it('respects operator precedence and parentheses', () => {
    expect(
      values(computedColumnNative(df, { newColumnName: 'r', expression: 'df["a"] + df["b"] * 2' }), 'r')
    ).toEqual([8, 18]);
    expect(
      values(computedColumnNative(df, { newColumnName: 'r', expression: '(df["a"] + df["b"]) * 2' }), 'r')
    ).toEqual([10, 28]);
  });

  it('supports ** as right-associative exponentiation', () => {
    expect(values(computedColumnNative(df, { newColumnName: 'p', expression: 'df["b"] ** 2' }), 'p')).toEqual([
      9, 16,
    ]);
    // 2 ** 3 ** 2 === 2 ** 9 === 512 (right assoc)
    expect(values(computedColumnNative(df, { newColumnName: 'p', expression: '2 ** 3 ** 2' }), 'p')).toEqual([
      512, 512,
    ]);
  });

  it('supports unary minus, modulo, and division', () => {
    expect(values(computedColumnNative(df, { newColumnName: 'n', expression: '-df["a"]' }), 'n')).toEqual([
      -2, -10,
    ]);
    expect(values(computedColumnNative(df, { newColumnName: 'm', expression: 'df["a"] % df["b"]' }), 'm')).toEqual(
      [2, 2]
    );
    expect(values(computedColumnNative(df, { newColumnName: 'd', expression: 'df["a"] / df["b"]' }), 'd')).toEqual(
      [2 / 3, 2.5]
    );
  });

  it('concatenates strings with +', () => {
    const out = computedColumnNative(df, {
      newColumnName: 'name',
      expression: 'df["first"] + " " + df["last"]',
    });
    expect(values(out, 'name')).toEqual(['Ada Lovelace', 'Alan Turing']);
    expect(out!.columns.find((c) => c.name === 'name')?.type).toBe('string');
  });

  it('overwrites an existing column in place (keeps column order)', () => {
    const out = computedColumnNative(df, { newColumnName: 'a', expression: 'df["a"] * 10' });
    expect(out!.columns.map((c) => c.name)).toEqual(['a', 'b', 'first', 'last']);
    expect(values(out, 'a')).toEqual([20, 100]);
  });

  it('handles single-quoted column refs and numeric literals with underscores', () => {
    expect(values(computedColumnNative(df, { newColumnName: 'x', expression: "df['a'] + 1_000" }), 'x')).toEqual([
      1002, 1010,
    ]);
  });

  it('propagates null for missing operands and divide-by-zero', () => {
    const withNulls: DataFrame = {
      columns: [
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
      ],
      rows: [
        { a: 4, b: 0 },
        { a: null, b: 2 },
      ],
    };
    expect(values(computedColumnNative(withNulls, { newColumnName: 'd', expression: 'df["a"] / df["b"]' }), 'd')).toEqual(
      [null, null]
    );
  });
});

describe('computedColumnNative — fallback cases (return null)', () => {
  it('returns null for incomplete config', () => {
    expect(computedColumnNative(df, {})).toBeNull();
    expect(computedColumnNative(df, { newColumnName: 'x', expression: '   ' })).toBeNull();
  });

  it('returns null for method calls and unsupported identifiers', () => {
    expect(computedColumnNative(df, { newColumnName: 'x', expression: 'df["first"].str.upper()' })).toBeNull();
    expect(computedColumnNative(df, { newColumnName: 'x', expression: 'np.log(df["a"])' })).toBeNull();
    expect(computedColumnNative(df, { newColumnName: 'x', expression: 'df["a"] > df["b"]' })).toBeNull();
  });

  it('returns null for malformed expressions', () => {
    expect(computedColumnNative(df, { newColumnName: 'x', expression: 'df["a"] +' })).toBeNull();
    expect(computedColumnNative(df, { newColumnName: 'x', expression: '(df["a"]' })).toBeNull();
    expect(computedColumnNative(df, { newColumnName: 'x', expression: 'df[a]' })).toBeNull();
  });
});
