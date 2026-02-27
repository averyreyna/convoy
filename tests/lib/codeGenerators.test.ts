import { describe, it, expect } from 'vitest';
import { getEditorLanguage, generateNodeCode } from '@/lib/codeGenerators';

describe('getEditorLanguage', () => {
  it('returns python for known node types', () => {
    expect(getEditorLanguage('filter')).toBe('python');
    expect(getEditorLanguage('sort')).toBe('python');
    expect(getEditorLanguage('transform')).toBe('python');
    expect(getEditorLanguage('chart')).toBe('python');
    expect(getEditorLanguage('dataSource')).toBe('python');
  });
});

describe('generateNodeCode', () => {
  describe('filter', () => {
    it('returns placeholder when column or operator missing', () => {
      expect(generateNodeCode('filter', {})).toContain('Filter node');
      expect(generateNodeCode('filter', { column: 'x' })).toContain('Filter node');
      expect(generateNodeCode('filter', { operator: 'eq' })).toContain('Filter node');
    });

    it('returns placeholder when value required but empty for eq/neq/gt/lt', () => {
      const out = generateNodeCode('filter', { column: 'x', operator: 'eq', value: '' });
      expect(out).toContain('Filter node');
    });

    it('generates eq filter with string value', () => {
      const out = generateNodeCode('filter', { column: 'name', operator: 'eq', value: 'alice' });
      expect(out).toBe('df = df[df["name"] == "alice"]');
    });

    it('generates eq filter with numeric value', () => {
      const out = generateNodeCode('filter', { column: 'age', operator: 'eq', value: '42' });
      expect(out).toBe('df = df[df["age"] == 42]');
    });

    it('generates neq, gt, lt filters', () => {
      expect(generateNodeCode('filter', { column: 'a', operator: 'neq', value: 'x' })).toContain('!=');
      expect(generateNodeCode('filter', { column: 'a', operator: 'gt', value: '10' })).toContain('>');
      expect(generateNodeCode('filter', { column: 'a', operator: 'lt', value: '5' })).toContain('<');
    });

    it('generates contains and startsWith filters', () => {
      const contains = generateNodeCode('filter', { column: 'col', operator: 'contains', value: 'ab' });
      expect(contains).toContain('str.contains');
      const starts = generateNodeCode('filter', { column: 'col', operator: 'startsWith', value: 'ab' });
      expect(starts).toContain('str.startswith');
    });

    it('escapes column and value for Python strings', () => {
      const out = generateNodeCode('filter', { column: 'col"x', operator: 'eq', value: 'a"b' });
      expect(out).toContain('\\"');
    });
  });

  describe('sort', () => {
    it('returns placeholder when column missing', () => {
      expect(generateNodeCode('sort', {})).toContain('Sort node');
    });

    it('generates ascending sort by default', () => {
      expect(generateNodeCode('sort', { column: 'date' })).toContain('ascending=True');
    });

    it('generates descending sort when direction is desc', () => {
      expect(generateNodeCode('sort', { column: 'date', direction: 'desc' })).toContain('ascending=False');
    });
  });

  describe('select', () => {
    it('returns placeholder when columns empty or missing', () => {
      expect(generateNodeCode('select', {})).toContain('Select Columns');
      expect(generateNodeCode('select', { columns: [] })).toContain('Select Columns');
    });

    it('generates df[[]] with selected columns', () => {
      const out = generateNodeCode('select', { columns: ['a', 'b'] });
      expect(out).toBe('df = df[["a", "b"]]');
    });
  });

  describe('groupBy', () => {
    it('returns placeholder when groupByColumn or aggregation missing', () => {
      expect(generateNodeCode('groupBy', {})).toContain('Group By');
    });

    it('generates groupby with mean for avg', () => {
      const out = generateNodeCode('groupBy', {
        groupByColumn: 'region',
        aggregateColumn: 'sales',
        aggregation: 'avg',
      });
      expect(out).toContain('groupby("region")');
      expect(out).toContain('.mean()');
    });

    it('generates groupby with sum/count', () => {
      expect(generateNodeCode('groupBy', { groupByColumn: 'x', aggregation: 'sum' })).toContain('.sum()');
      expect(generateNodeCode('groupBy', { groupByColumn: 'x', aggregation: 'count' })).toContain('.count()');
    });
  });

  describe('computedColumn', () => {
    it('returns placeholder when newColumnName or expression missing', () => {
      expect(generateNodeCode('computedColumn', {})).toContain('Computed Column');
    });

    it('generates df["name"] = expression', () => {
      const out = generateNodeCode('computedColumn', {
        newColumnName: 'total',
        expression: 'df["a"] + df["b"]',
      });
      expect(out).toBe('df["total"] = df["a"] + df["b"]');
    });
  });

  describe('reshape', () => {
    it('returns placeholder when keyColumn, valueColumn, or pivotColumns missing', () => {
      expect(generateNodeCode('reshape', {})).toContain('Reshape');
    });

    it('generates pd.melt with id_vars and value_vars', () => {
      const out = generateNodeCode('reshape', {
        keyColumn: 'variable',
        valueColumn: 'value',
        pivotColumns: ['q1', 'q2'],
      });
      expect(out).toContain('pd.melt');
      expect(out).toContain('var_name="variable"');
      expect(out).toContain('value_name="value"');
      expect(out).toContain('"q1"');
      expect(out).toContain('"q2"');
    });
  });

  describe('transform', () => {
    it('returns customCode when provided', () => {
      const code = 'df = df.assign(x=1)';
      expect(generateNodeCode('transform', { customCode: code })).toBe(code);
    });

    it('returns placeholder when no customCode', () => {
      expect(generateNodeCode('transform', {})).toContain('Custom transform');
    });
  });

  describe('dataSource', () => {
    it('returns placeholder when fileName missing', () => {
      expect(generateNodeCode('dataSource', {})).toContain('Data Source');
      expect(generateNodeCode('dataSource', {})).toContain('pd.DataFrame()');
    });

    it('generates pd.read_csv when fileName set', () => {
      const out = generateNodeCode('dataSource', { fileName: 'data.csv' });
      expect(out).toContain('pd.read_csv("data.csv")');
      expect(out).toContain('Loaded');
    });
  });

  describe('chart', () => {
    it('returns placeholder when xAxis or yAxis missing', () => {
      expect(generateNodeCode('chart', {})).toContain('Chart node');
    });

    it('generates bar chart code', () => {
      const out = generateNodeCode('chart', {
        chartType: 'bar',
        xAxis: 'x',
        yAxis: 'y',
      });
      expect(out).toContain('plt.bar');
      expect(out).toContain('df["x"]');
      expect(out).toContain('df["y"]');
    });

    it('generates line chart code', () => {
      const out = generateNodeCode('chart', { chartType: 'line', xAxis: 'a', yAxis: 'b' });
      expect(out).toContain('plt.plot');
    });
  });

  describe('unknown node type', () => {
    it('returns comment containing Unknown node type', () => {
      const out = generateNodeCode('unknownType', {});
      expect(out).toContain('Unknown node type');
      expect(out).toContain('unknownType');
    });
  });
});
