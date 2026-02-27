import { describe, it, expect } from 'vitest';
import { validateSyntax } from '@/lib/codeValidation';

describe('validateSyntax', () => {
  it('returns valid for empty string', () => {
    expect(validateSyntax('')).toEqual({ valid: true });
  });

  it('returns valid for whitespace-only string', () => {
    expect(validateSyntax('   ')).toEqual({ valid: true });
    expect(validateSyntax('\n\t  \n')).toEqual({ valid: true });
  });

  it('returns valid for balanced parentheses', () => {
    expect(validateSyntax('( )')).toEqual({ valid: true });
    expect(validateSyntax('(foo(bar))')).toEqual({ valid: true });
  });

  it('returns valid for balanced brackets', () => {
    expect(validateSyntax('[ ]')).toEqual({ valid: true });
    expect(validateSyntax('[[1], [2]]')).toEqual({ valid: true });
  });

  it('returns valid for balanced braces', () => {
    expect(validateSyntax('{ }')).toEqual({ valid: true });
    expect(validateSyntax('{ "a": 1 }')).toEqual({ valid: true });
  });

  it('returns valid for mixed balanced delimiters', () => {
    expect(validateSyntax('([{}])')).toEqual({ valid: true });
    expect(validateSyntax('def f(): return [1, 2]')).toEqual({ valid: true });
  });

  it('returns invalid for unmatched closing parenthesis with error and location', () => {
    const result = validateSyntax(')');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unmatched ")"');
    expect(result.line).toBe(1);
    expect(result.column).toBe(1);
  });

  it('returns invalid for unmatched closing bracket with location', () => {
    const result = validateSyntax('x ]');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unmatched "]"');
    expect(result.line).toBe(1);
    expect(result.column).toBe(3);
  });

  it('returns invalid for unmatched closing brace with location', () => {
    const result = validateSyntax('}\n');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unmatched "}"');
    expect(result.line).toBe(1);
    expect(result.column).toBe(1);
  });

  it('returns invalid for mismatched pairs with location of opening delimiter', () => {
    const result = validateSyntax('( ]');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Mismatched "(" and "]"');
    expect(result.line).toBe(1);
    expect(result.column).toBe(1);
  });

  it('returns invalid for unclosed opening parenthesis with location', () => {
    const result = validateSyntax('( foo');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unclosed "("');
    expect(result.line).toBe(1);
    expect(result.column).toBe(1);
  });

  it('returns invalid for unclosed opening bracket on line 2', () => {
    const result = validateSyntax('x = 1\n[');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unclosed "["');
    expect(result.line).toBe(2);
    expect(result.column).toBe(1);
  });

  it('returns invalid for unclosed opening brace with column', () => {
    const result = validateSyntax('  {');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unclosed "{"');
    expect(result.line).toBe(1);
    expect(result.column).toBe(3);
  });
});
