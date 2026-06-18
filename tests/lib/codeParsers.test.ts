import { describe, it, expect } from 'vitest';
import { generateNodeCode } from '@/lib/codeGenerators';
import { parseNodeCode, isParseable, PARSEABLE_NODE_TYPES } from '@/lib/codeParsers';

/**
 * The contract these tests pin down: parseNodeCode is the exact inverse of
 * generateNodeCode for every structured node type. parse(generate(config)) must
 * recover config, so editing a cell's code can sync straight back into the node.
 */

const roundTripCases: Array<{ type: string; config: Record<string, unknown> }> = [
  // filter — numeric comparison
  { type: 'filter', config: { column: 'age', operator: 'gt', value: '30' } },
  { type: 'filter', config: { column: 'age', operator: 'eq', value: '25' } },
  { type: 'filter', config: { column: 'age', operator: 'neq', value: '0' } },
  { type: 'filter', config: { column: 'age', operator: 'lt', value: '100' } },
  // filter — string comparison (non-numeric value stays quoted)
  { type: 'filter', config: { column: 'city', operator: 'eq', value: 'NYC' } },
  // filter — string ops
  { type: 'filter', config: { column: 'name', operator: 'contains', value: 'ali' } },
  { type: 'filter', config: { column: 'name', operator: 'startsWith', value: 'A' } },
  // filter — column name needing escape
  { type: 'filter', config: { column: 'wei"rd', operator: 'eq', value: 'x' } },

  // sort
  { type: 'sort', config: { column: 'age', direction: 'asc' } },
  { type: 'sort', config: { column: 'age', direction: 'desc' } },

  // select
  { type: 'select', config: { columns: ['name', 'age'] } },
  { type: 'select', config: { columns: ['only_one'] } },

  // groupBy — every aggregation, incl. avg→mean round-trip
  { type: 'groupBy', config: { groupByColumn: 'city', aggregateColumn: 'age', aggregation: 'avg' } },
  { type: 'groupBy', config: { groupByColumn: 'city', aggregateColumn: 'age', aggregation: 'sum' } },
  { type: 'groupBy', config: { groupByColumn: 'city', aggregateColumn: 'age', aggregation: 'count' } },
  { type: 'groupBy', config: { groupByColumn: 'city', aggregateColumn: 'age', aggregation: 'min' } },
  { type: 'groupBy', config: { groupByColumn: 'city', aggregateColumn: 'age', aggregation: 'max' } },

  // computedColumn
  { type: 'computedColumn', config: { newColumnName: 'total', expression: 'df["a"] + df["b"]' } },

  // reshape
  {
    type: 'reshape',
    config: { keyColumn: 'metric', valueColumn: 'amount', pivotColumns: ['q1', 'q2'] },
  },
];

describe('parseNodeCode round-trips generateNodeCode', () => {
  for (const { type, config } of roundTripCases) {
    it(`${type}: ${JSON.stringify(config)}`, () => {
      const code = generateNodeCode(type, config);
      const parsed = parseNodeCode(type, code);
      expect(parsed).toEqual(config);
    });
  }
});

describe('parseNodeCode returns null for non-structured code', () => {
  it('rejects placeholders / comments', () => {
    // Incomplete configs generate comment placeholders, which must not parse.
    expect(parseNodeCode('filter', generateNodeCode('filter', {}))).toBeNull();
    expect(parseNodeCode('sort', generateNodeCode('sort', {}))).toBeNull();
    expect(parseNodeCode('groupBy', generateNodeCode('groupBy', {}))).toBeNull();
  });

  it('rejects free-form / multi-statement code', () => {
    expect(parseNodeCode('filter', 'df = df.dropna()')).toBeNull();
    expect(parseNodeCode('select', 'df = df.head(10)')).toBeNull();
    expect(
      parseNodeCode('computedColumn', 'df["a"] = 1\ndf["b"] = 2')
    ).toBeNull();
  });

  it('rejects unknown / non-parseable node types', () => {
    expect(parseNodeCode('chart', 'plt.show()')).toBeNull();
    expect(parseNodeCode('transform', 'df = df')).toBeNull();
    expect(parseNodeCode('dataSource', 'df = pd.DataFrame()')).toBeNull();
  });

  it('rejects an unknown groupBy aggregation', () => {
    expect(
      parseNodeCode('groupBy', 'df = df.groupby("c")["v"].median().reset_index()')
    ).toBeNull();
  });
});

describe('PARSEABLE_NODE_TYPES', () => {
  it('matches the documented set', () => {
    expect([...PARSEABLE_NODE_TYPES].sort()).toEqual(
      ['computedColumn', 'filter', 'groupBy', 'reshape', 'select', 'sort'].sort()
    );
    expect(isParseable('filter')).toBe(true);
    expect(isParseable('chart')).toBe(false);
  });
});
