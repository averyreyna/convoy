/**
 * Utilities for validating user-written code before execution.
 * Supports Python only (Convoy is Python-first).
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
 * Check for balanced brackets/parentheses/braces in Python code.
 * Best-effort only; does not skip string contents, so may false-positive inside strings.
 */
function checkBalancedDelimiters(code: string): ValidationResult {
  const stack: { char: string; line: number; col: number }[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const open = new Set(['(', '[', '{']);
  const lines = code.split('\n');

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];
    for (let col = 0; col < line.length; col++) {
      const c = line[col];
      if (open.has(c)) {
        stack.push({ char: c, line: lineNum, col: col + 1 });
      } else if (pairs[c]) {
        if (stack.length === 0) {
          return {
            valid: false,
            error: `Unmatched "${c}"`,
            line: lineNum,
            column: col + 1,
          };
        }
        const top = stack.pop()!;
        if (top.char !== pairs[c]) {
          return {
            valid: false,
            error: `Mismatched "${top.char}" and "${c}"`,
            line: top.line,
            column: top.col,
          };
        }
      }
    }
  }

  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    return {
      valid: false,
      error: `Unclosed "${top.char}"`,
      line: top.line,
      column: top.col,
    };
  }
  return { valid: true };
}

/**
 * Validate Python syntax with a lightweight check (balanced delimiters).
 * Full AST validation would require Pyodide or a Python parser in JS.
 */
export function validateSyntax(code: string): ValidationResult {
  if (!code || code.trim() === '') {
    return { valid: true };
  }

  return checkBalancedDelimiters(code);
}
