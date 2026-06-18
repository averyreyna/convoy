import { describe, it, expect } from 'vitest';
import type { DataFrame } from '@/types';
import {
  executeNodeNative,
  isNativelySupported,
  NATIVE_NODE_TYPES,
} from '@/lib/nativeExecutors';
import { filterNative } from '@/lib/nativeExecutors/filter';
import { sortNative } from '@/lib/nativeExecutors/sort';
import { selectNative } from '@/lib/nativeExecutors/select';
import { groupByNative } from '@/lib/nativeExecutors/groupBy';
import { reshapeNative } from '@/lib/nativeExecutors/reshape';

/**
 * These tests assert the native engine matches the semantics of the pandas code
 * produced by @/lib/codeGenerators. Expected values are hand-derived from how
 * pandas would evaluate the equivalent generated expression.
 */

const people: DataFrame = {
  columns: [
    { name: 'name', type: 'string' },
    { name: 'age', type: 'number' },
    { name: 'city', type: 'string' },
  ],
  rows: [
    { name: 'Alice', age: 30, city: 'NYC' },
    { name: 'Bob', age: 25, city: 'LA' },
    { name: 'Carol', age: 30, city: 'NYC' },
    { name: 'Dave', age: 40, city: 'SF' },
  ],
};

describe('engine routing', () => {
  it('reports supported native node types', () => {
    expect(isNativelySupported('filter')).toBe(true);
    expect(isNativelySupported('computedColumn')).toBe(false);
    expect(isNativelySupported('transform')).toBe(false);
    expect([...NATIVE_NODE_TYPES].sort()).toEqual(
      ['filter', 'groupBy', 'reshape', 'select', 'sort'].sort()
    );
  });

  it('returns null for unsupported types so the caller can fall back', () => {
    expect(executeNodeNative('transform', people, {})).toBeNull();
    expect(executeNodeNative('computedColumn', people, {})).toBeNull();
  });

  it('dispatches supported types', () => {
    const out = executeNodeNative('select', people, { columns: ['name'] });
    expect(out?.columns.map((c) => c.name)).toEqual(['name']);
  });
});

describe('filterNative', () => {
  it('numeric eq: df[df["age"] == 30]', () => {
    const out = filterNative(people, { column: 'age', operator: 'eq', value: '30' });
    expect(out.rows.map((r) => r.name)).toEqual(['Alice', 'Carol']);
  });

  it('numeric gt: df[df["age"] > 28]', () => {
    const out = filterNative(people, { column: 'age', operator: 'gt', value: '28' });
    expect(out.rows.map((r) => r.name)).toEqual(['Alice', 'Carol', 'Dave']);
  });

  it('numeric lt and neq', () => {
    expect(
      filterNative(people, { column: 'age', operator: 'lt', value: '30' }).rows.map((r) => r.name)
    ).toEqual(['Bob']);
    expect(
      filterNative(people, { column: 'age', operator: 'neq', value: '30' }).rows.map((r) => r.name)
    ).toEqual(['Bob', 'Dave']);
  });

  it('string eq is exact and case-sensitive', () => {
    expect(
      filterNative(people, { column: 'city', operator: 'eq', value: 'NYC' }).rows.map((r) => r.name)
    ).toEqual(['Alice', 'Carol']);
    expect(
      filterNative(people, { column: 'city', operator: 'eq', value: 'nyc' }).rows
    ).toHaveLength(0);
  });

  it('contains is case-insensitive substring (na=False)', () => {
    const df: DataFrame = {
      columns: [{ name: 'city', type: 'string' }],
      rows: [{ city: 'New York' }, { city: 'newark' }, { city: null }, { city: 'LA' }],
    };
    const out = filterNative(df, { column: 'city', operator: 'contains', value: 'new' });
    expect(out.rows.map((r) => r.city)).toEqual(['New York', 'newark']);
  });

  it('startsWith is case-sensitive prefix (na=False)', () => {
    const df: DataFrame = {
      columns: [{ name: 'city', type: 'string' }],
      rows: [{ city: 'New York' }, { city: 'newark' }, { city: null }],
    };
    const out = filterNative(df, { column: 'city', operator: 'startsWith', value: 'New' });
    expect(out.rows.map((r) => r.city)).toEqual(['New York']);
  });

  it('passes through when config is incomplete', () => {
    expect(filterNative(people, { column: 'age', operator: 'eq', value: '' }).rows).toHaveLength(4);
    expect(filterNative(people, {}).rows).toHaveLength(4);
  });

  it('preserves columns', () => {
    const out = filterNative(people, { column: 'age', operator: 'gt', value: '100' });
    expect(out.columns).toEqual(people.columns);
    expect(out.rows).toHaveLength(0);
  });
});

describe('sortNative', () => {
  it('sorts numeric ascending', () => {
    const out = sortNative(people, { column: 'age', direction: 'asc' });
    expect(out.rows.map((r) => r.age)).toEqual([25, 30, 30, 40]);
  });

  it('sorts numeric descending', () => {
    const out = sortNative(people, { column: 'age', direction: 'desc' });
    expect(out.rows.map((r) => r.age)).toEqual([40, 30, 30, 25]);
  });

  it('sorts strings lexicographically', () => {
    const out = sortNative(people, { column: 'name', direction: 'desc' });
    expect(out.rows.map((r) => r.name)).toEqual(['Dave', 'Carol', 'Bob', 'Alice']);
  });

  it('places missing values last regardless of direction', () => {
    const df: DataFrame = {
      columns: [{ name: 'age', type: 'number' }],
      rows: [{ age: 3 }, { age: null }, { age: 1 }],
    };
    expect(sortNative(df, { column: 'age', direction: 'asc' }).rows.map((r) => r.age)).toEqual([
      1, 3, null,
    ]);
    expect(sortNative(df, { column: 'age', direction: 'desc' }).rows.map((r) => r.age)).toEqual([
      3, 1, null,
    ]);
  });

  it('does not mutate the input', () => {
    const before = people.rows.map((r) => r.age);
    sortNative(people, { column: 'age', direction: 'desc' });
    expect(people.rows.map((r) => r.age)).toEqual(before);
  });
});

describe('selectNative', () => {
  it('projects in requested order', () => {
    const out = selectNative(people, { columns: ['city', 'name'] });
    expect(out.columns.map((c) => c.name)).toEqual(['city', 'name']);
    expect(out.rows[0]).toEqual({ city: 'NYC', name: 'Alice' });
    expect(Object.keys(out.rows[0])).toEqual(['city', 'name']);
  });

  it('drops unknown column names', () => {
    const out = selectNative(people, { columns: ['name', 'missing'] });
    expect(out.columns.map((c) => c.name)).toEqual(['name']);
  });

  it('passes through when no columns selected', () => {
    expect(selectNative(people, { columns: [] }).columns).toHaveLength(3);
  });
});

describe('groupByNative', () => {
  it('count groups by key, counts non-null, keys sorted', () => {
    const out = groupByNative(people, {
      groupByColumn: 'city',
      aggregateColumn: 'name',
      aggregation: 'count',
    });
    expect(out.columns.map((c) => c.name)).toEqual(['city', 'name']);
    expect(out.rows).toEqual([
      { city: 'LA', name: 1 },
      { city: 'NYC', name: 2 },
      { city: 'SF', name: 1 },
    ]);
    expect(out.columns[1].type).toBe('number');
  });

  it('sum and avg over numeric agg column', () => {
    const sum = groupByNative(people, {
      groupByColumn: 'city',
      aggregateColumn: 'age',
      aggregation: 'sum',
    });
    expect(sum.rows).toEqual([
      { city: 'LA', age: 25 },
      { city: 'NYC', age: 60 },
      { city: 'SF', age: 40 },
    ]);
    const avg = groupByNative(people, {
      groupByColumn: 'city',
      aggregateColumn: 'age',
      aggregation: 'avg',
    });
    expect(avg.rows).toEqual([
      { city: 'LA', age: 25 },
      { city: 'NYC', age: 30 },
      { city: 'SF', age: 40 },
    ]);
  });

  it('min and max over numeric column', () => {
    const max = groupByNative(people, {
      groupByColumn: 'city',
      aggregateColumn: 'age',
      aggregation: 'max',
    });
    expect(max.rows.find((r) => r.city === 'NYC')?.age).toBe(30);
    const min = groupByNative(people, {
      groupByColumn: 'city',
      aggregateColumn: 'age',
      aggregation: 'min',
    });
    expect(min.rows.find((r) => r.city === 'NYC')?.age).toBe(30);
  });

  it('numeric group keys sort numerically not lexically', () => {
    const df: DataFrame = {
      columns: [
        { name: 'g', type: 'number' },
        { name: 'v', type: 'number' },
      ],
      rows: [
        { g: 10, v: 1 },
        { g: 2, v: 1 },
        { g: 1, v: 1 },
      ],
    };
    const out = groupByNative(df, { groupByColumn: 'g', aggregateColumn: 'v', aggregation: 'sum' });
    expect(out.rows.map((r) => r.g)).toEqual([1, 2, 10]);
  });
});

describe('reshapeNative', () => {
  it('melts wide to long, value_vars outer / rows inner', () => {
    const wide: DataFrame = {
      columns: [
        { name: 'year', type: 'number' },
        { name: 'apples', type: 'number' },
        { name: 'oranges', type: 'number' },
      ],
      rows: [
        { year: 2020, apples: 10, oranges: 5 },
        { year: 2021, apples: 20, oranges: 7 },
      ],
    };
    const out = reshapeNative(wide, {
      keyColumn: 'fruit',
      valueColumn: 'count',
      pivotColumns: ['apples', 'oranges'],
    });
    expect(out.columns.map((c) => c.name)).toEqual(['year', 'fruit', 'count']);
    expect(out.rows).toEqual([
      { year: 2020, fruit: 'apples', count: 10 },
      { year: 2021, fruit: 'apples', count: 20 },
      { year: 2020, fruit: 'oranges', count: 5 },
      { year: 2021, fruit: 'oranges', count: 7 },
    ]);
    expect(out.columns[1].type).toBe('string');
    expect(out.columns[2].type).toBe('number');
  });

  it('passes through when incomplete', () => {
    const wide: DataFrame = {
      columns: [{ name: 'a', type: 'number' }],
      rows: [{ a: 1 }],
    };
    expect(reshapeNative(wide, { pivotColumns: [] }).rows).toHaveLength(1);
  });
});
