import { describe, it, expect } from 'vitest';
import { generateNodeCode } from '@/lib/codeGenerators';
import { resolveDiagnosticSpans, diagnosticsWithoutSpans } from '@/lib/schemaDiagnosticSpans';

describe('resolveDiagnosticSpans', () => {
  it('underlines a missing column in filter code', () => {
    const code = generateNodeCode('filter', { column: 'nope', operator: 'eq', value: '1' });
    const diagnostics = [
      {
        severity: 'error' as const,
        message: 'Column "nope" does not exist in the input data',
        column: 'nope',
      },
    ];
    const spans = resolveDiagnosticSpans(code, diagnostics);
    expect(spans).toHaveLength(1);
    expect(spans[0].message).toContain('nope');
    expect(spans[0].startColumn).toBeGreaterThan(0);
  });

  it('underlines a column in sort_values', () => {
    const code = generateNodeCode('sort', { column: 'price', direction: 'asc' });
    const diagnostics = [
      {
        severity: 'error' as const,
        message: 'Column "price" does not exist',
        column: 'price',
      },
    ];
    const spans = resolveDiagnosticSpans(code, diagnostics);
    expect(spans).toHaveLength(1);
    expect(code.slice(spans[0].startColumn - 1, spans[0].endColumn - 1)).toBe('price');
  });

  it('returns empty when column cannot be located', () => {
    const spans = resolveDiagnosticSpans('df = df.head()', [
      { severity: 'error', message: 'missing', column: 'ghost' },
    ]);
    expect(spans).toEqual([]);
  });
});

describe('diagnosticsWithoutSpans', () => {
  it('keeps diagnostics that have no inline span', () => {
    const diagnostics = [{ severity: 'warning' as const, message: 'general warning' }];
    expect(diagnosticsWithoutSpans('df = df', diagnostics)).toEqual(diagnostics);
  });
});
