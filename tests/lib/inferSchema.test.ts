import { describe, it, expect } from 'vitest';
import type { Column } from '@/types';
import { generateNodeCode } from '@/lib/codeGenerators';
import {
  inferSchema,
  inferSchemaFromCode,
  inferLineageSchemas,
  classifyCell,
  knownSchema,
  unknownSchema,
  type Schema,
} from '@/lib/inferSchema';

const base: Column[] = [
  { name: 'city', type: 'string' },
  { name: 'price', type: 'number' },
  { name: 'qty', type: 'number' },
];
const input: Schema = knownSchema(base);

const colNames = (s: Schema) => (s.kind === 'known' ? s.columns.map((c) => c.name) : '<unknown>');

describe('inferSchema — output schema per step', () => {
  it('filter and sort are schema-preserving', () => {
    expect(colNames(inferSchema(input, { type: 'filter', config: { column: 'price', operator: 'gt', value: '10' } }).outputSchema)).toEqual(['city', 'price', 'qty']);
    expect(colNames(inferSchema(input, { type: 'sort', config: { column: 'price', direction: 'desc' } }).outputSchema)).toEqual(['city', 'price', 'qty']);
  });

  it('select narrows to the chosen columns in order', () => {
    const out = inferSchema(input, { type: 'select', config: { columns: ['price', 'city'] } }).outputSchema;
    expect(colNames(out)).toEqual(['price', 'city']);
  });

  it('groupBy outputs [groupCol, aggCol] with a numeric agg result', () => {
    const { outputSchema } = inferSchema(input, {
      type: 'groupBy',
      config: { groupByColumn: 'city', aggregateColumn: 'price', aggregation: 'sum' },
    });
    expect(outputSchema).toEqual(knownSchema([
      { name: 'city', type: 'string' },
      { name: 'price', type: 'number' },
    ]));
  });

  it('computedColumn appends a column; arithmetic expressions are numeric', () => {
    const out = inferSchema(input, {
      type: 'computedColumn',
      config: { newColumnName: 'total', expression: 'df["price"] * df["qty"]' },
    }).outputSchema;
    expect(colNames(out)).toEqual(['city', 'price', 'qty', 'total']);
    if (out.kind === 'known') expect(out.columns.at(-1)).toEqual({ name: 'total', type: 'number' });
  });

  it('reshape melts pivot columns into key/value, keeping id_vars', () => {
    const out = inferSchema(input, {
      type: 'reshape',
      config: { keyColumn: 'metric', valueColumn: 'amount', pivotColumns: ['price', 'qty'] },
    }).outputSchema;
    expect(colNames(out)).toEqual(['city', 'metric', 'amount']);
  });

  it('opaque steps (transform) erase the schema to unknown', () => {
    expect(inferSchema(input, { type: 'transform', config: {} }).outputSchema).toEqual(unknownSchema);
  });
});

describe('inferSchema — diagnostics', () => {
  it('flags a referenced column that does not exist', () => {
    const { diagnostics } = inferSchema(input, { type: 'filter', config: { column: 'nope', operator: 'eq', value: '1' } });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ severity: 'error', column: 'nope' });
  });

  it('warns on a string-op against a non-string column', () => {
    const { diagnostics } = inferSchema(input, { type: 'filter', config: { column: 'price', operator: 'contains', value: 'x' } });
    expect(diagnostics[0]).toMatchObject({ severity: 'warning', column: 'price' });
  });

  it('warns on numeric aggregation of a non-numeric column', () => {
    const { diagnostics } = inferSchema(input, { type: 'groupBy', config: { groupByColumn: 'price', aggregateColumn: 'city', aggregation: 'sum' } });
    expect(diagnostics.some((d) => d.severity === 'warning' && d.column === 'city')).toBe(true);
  });

  it('reports each missing column in a select', () => {
    const { diagnostics } = inferSchema(input, { type: 'select', config: { columns: ['price', 'ghost'] } });
    expect(diagnostics).toEqual([expect.objectContaining({ column: 'ghost', severity: 'error' })]);
  });
});

describe('gradual `?` — unknown input', () => {
  it('suppresses existence diagnostics and stays unknown', () => {
    const r = inferSchema(unknownSchema, { type: 'filter', config: { column: 'whatever', operator: 'eq', value: '1' } });
    expect(r.diagnostics).toEqual([]);
    expect(r.outputSchema).toEqual(unknownSchema);
  });

  it('a dataSource recovers a known schema from unknown', () => {
    const { outputSchema } = inferSchema(unknownSchema, { type: 'dataSource', config: { columns: base } });
    expect(outputSchema).toEqual(knownSchema(base));
  });
});

describe('inferSchemaFromCode — code-first path', () => {
  it('treats empty / comment-only cells as holes (passthrough)', () => {
    expect(inferSchemaFromCode(input, '   ').outputSchema).toEqual(input);
    expect(inferSchemaFromCode(input, '# just a note').outputSchema).toEqual(input);
  });

  it('classifies a generated cell and infers precisely without a known type', () => {
    const code = generateNodeCode('select', { columns: ['price', 'city'] });
    expect(colNames(inferSchemaFromCode(input, code).outputSchema)).toEqual(['price', 'city']);
  });

  it('opaque free-form code yields unknown, no diagnostics', () => {
    const r = inferSchemaFromCode(input, 'df = df.pipe(my_helper)');
    expect(r.outputSchema).toEqual(unknownSchema);
    expect(r.diagnostics).toEqual([]);
  });

  it('a node-backed cell whose code drifts from its type is opaque', () => {
    const r = inferSchemaFromCode(input, 'df = something_else()', 'filter');
    expect(r.outputSchema).toEqual(unknownSchema);
  });
});

describe('classifyCell', () => {
  it('recognises each parseable generated shape', () => {
    expect(classifyCell(generateNodeCode('filter', { column: 'price', operator: 'gt', value: '5' }))?.type).toBe('filter');
    expect(classifyCell(generateNodeCode('groupBy', { groupByColumn: 'city', aggregateColumn: 'price', aggregation: 'avg' }))?.type).toBe('groupBy');
    expect(classifyCell('df = df.pipe(x)')).toBeNull();
  });
});

describe('inferLineageSchemas — threading down a lineage', () => {
  it('feeds each step its predecessor output and collects per-step diagnostics', () => {
    const steps = [
      { type: 'dataSource', config: { columns: base } },
      { type: 'computedColumn', config: { newColumnName: 'total', expression: 'df["price"] * df["qty"]' } },
      { type: 'select', config: { columns: ['city', 'total'] } },
      { type: 'sort', config: { column: 'ghost', direction: 'asc' } },
    ];
    const lineage = inferLineageSchemas(steps);
    expect(colNames(lineage[1].outputSchema)).toEqual(['city', 'price', 'qty', 'total']);
    expect(colNames(lineage[2].outputSchema)).toEqual(['city', 'total']);
    // 'ghost' was dropped by select, so the downstream sort can't find it.
    expect(lineage[3].diagnostics[0]).toMatchObject({ column: 'ghost', severity: 'error' });
  });
});
