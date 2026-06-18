import { describe, it, expect } from 'vitest';
import type { Column } from '@/types';
import { generateNodeCode } from '@/lib/codeGenerators';
import { evaluateLineageLive, knownSchemaColumnSummary } from '@/lib/liveEval';
import { knownSchema, unknownSchema } from '@/lib/inferSchema';

const base: Column[] = [
  { name: 'city', type: 'string' },
  { name: 'price', type: 'number' },
];

const root = knownSchema(base);

describe('evaluateLineageLive', () => {
  it('treats empty cells as holes with passthrough schema', async () => {
    const results = await evaluateLineageLive([{ code: '# note' }], root);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('hole');
    expect(results[0].outputSchema).toEqual(root);
  });

  it('evaluates a structured filter on an empty frame', async () => {
    const code = generateNodeCode('filter', { column: 'price', operator: 'gt', value: '10' });
    const results = await evaluateLineageLive([{ code }], root);
    expect(results[0].status).toBe('complete');
    expect(results[0].outputPreview?.columns.map((c) => c.name)).toEqual(['city', 'price']);
    expect(results[0].outputPreview?.rows).toEqual([]);
  });

  it('marks opaque code as indeterminate with unknown schema', async () => {
    const results = await evaluateLineageLive([{ code: 'df = df.pipe(x)' }], root);
    expect(results[0].status).toBe('indeterminate');
    expect(results[0].outputSchema).toEqual(unknownSchema);
  });

  it('threads schema through a hole between structured cells', async () => {
    const filter = generateNodeCode('filter', { column: 'price', operator: 'gt', value: '0' });
    const sort = generateNodeCode('sort', { column: 'price', direction: 'asc' });
    const results = await evaluateLineageLive(
      [{ code: filter }, { code: '# hole' }, { code: sort }],
      root
    );
    expect(results[1].status).toBe('hole');
    expect(results[2].status).toBe('complete');
  });
});

describe('knownSchemaColumnSummary', () => {
  it('summarizes a few columns', () => {
    expect(knownSchemaColumnSummary(root)).toBe('city, price');
  });

  it('returns empty for unknown schema', () => {
    expect(knownSchemaColumnSummary(unknownSchema)).toBe('');
  });
});
