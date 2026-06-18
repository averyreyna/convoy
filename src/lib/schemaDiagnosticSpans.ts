import type { SchemaDiagnostic } from '@/lib/inferSchema';

export interface MarkerSpan {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  severity: SchemaDiagnostic['severity'];
  message: string;
}

function offsetToPosition(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function spanForQuotedName(
  code: string,
  columnName: string,
  matchIndex: number,
  matchText: string
): MarkerSpan | null {
  const escaped = columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inner = new RegExp(`(["'])${escaped}\\1`);
  const local = inner.exec(matchText);
  if (!local || local.index === undefined) return null;
  const nameStart = matchIndex + local.index + 1;
  const nameEnd = nameStart + columnName.length;
  const start = offsetToPosition(code, nameStart);
  const end = offsetToPosition(code, nameEnd);
  return {
    startLineNumber: start.line,
    startColumn: start.column,
    endLineNumber: end.line,
    endColumn: end.column,
    severity: 'error',
    message: '',
  };
}

/** Find underline ranges for a column name inside generated pandas patterns. */
function findColumnSpans(code: string, columnName: string): MarkerSpan[] {
  const escaped = columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`df\\[["']${escaped}["']\\]`, 'g'),
    new RegExp(`sort_values\\(["']${escaped}["']`, 'g'),
    new RegExp(`groupby\\(["']${escaped}["']\\)`, 'g'),
    new RegExp(`\\[["']${escaped}["']\\]`, 'g'),
    new RegExp(`["']${escaped}["']`, 'g'),
  ];

  for (const re of patterns) {
    const spans: MarkerSpan[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const span = spanForQuotedName(code, columnName, m.index, m[0]);
      if (span) spans.push(span);
    }
    if (spans.length > 0) return spans;
  }
  return [];
}

/**
 * Map schema diagnostics to editor underline spans. Diagnostics without a
 * resolvable column position are omitted (shown in the text strip instead).
 */
export function resolveDiagnosticSpans(
  code: string,
  diagnostics: SchemaDiagnostic[]
): MarkerSpan[] {
  const spans: MarkerSpan[] = [];
  const seen = new Set<string>();

  for (const d of diagnostics) {
    if (!d.column) continue;
    const key = `${d.severity}:${d.column}:${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const columnSpans = findColumnSpans(code, d.column);
    if (columnSpans.length === 0) continue;

    const first = columnSpans[0];
    spans.push({
      ...first,
      severity: d.severity,
      message: d.message,
    });
  }

  return spans;
}

/** Diagnostics that could not be mapped to inline spans (fallback strip). */
export function diagnosticsWithoutSpans(
  code: string,
  diagnostics: SchemaDiagnostic[]
): SchemaDiagnostic[] {
  const withSpans = new Set(
    resolveDiagnosticSpans(code, diagnostics).map((s) => s.message)
  );
  return diagnostics.filter((d) => !withSpans.has(d.message));
}
