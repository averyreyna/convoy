/**
 * Utilities for validating user-written JavaScript code before execution.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** 1-based line number where the error occurred, if extractable */
  line?: number;
  /** 1-based column number, if extractable */
  column?: number;
}

/**
 * Validate JavaScript syntax by attempting to parse it with `new Function()`.
 * Does NOT execute the code — only checks that it parses.
 */
export function validateSyntax(code: string): ValidationResult {
  if (!code || code.trim() === '') {
    return { valid: true };
  }

  try {
    // Wrap in function context (same as the transform executor)
    new Function('rows', 'columns', `"use strict";\n${code}`);
    return { valid: true };
  } catch (err) {
    if (err instanceof SyntaxError) {
      const { line, column } = extractLineColumn(err);
      return {
        valid: false,
        error: err.message,
        line: line !== undefined ? line - 1 : undefined, // subtract 1 for the "use strict" wrapper line
        column,
      };
    }
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown syntax error',
    };
  }
}

/**
 * Try to extract line/column from a SyntaxError.
 * Different JS engines format this differently.
 */
function extractLineColumn(err: SyntaxError): {
  line?: number;
  column?: number;
} {
  // V8 (Chrome): "Unexpected token '}' at line 3, column 5"
  // or the error might have lineNumber/columnNumber properties (SpiderMonkey)
  const errAny = err as unknown as Record<string, unknown>;
  if (typeof errAny.lineNumber === 'number') {
    return {
      line: errAny.lineNumber as number,
      column: (errAny.columnNumber as number) ?? undefined,
    };
  }

  // Try to extract from message
  const lineMatch = String(err.message).match(/line (\d+)/i);
  const colMatch = String(err.message).match(/column (\d+)/i);

  return {
    line: lineMatch ? Number(lineMatch[1]) : undefined,
    column: colMatch ? Number(colMatch[1]) : undefined,
  };
}
