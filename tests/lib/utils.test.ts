import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns single string as-is', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple strings with space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('converts numbers to strings', () => {
    expect(cn(1)).toBe('1');
    expect(cn('a', 2, 'b')).toBe('a 2 b');
  });

  it('ignores falsy values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
    expect(cn('a', null, 'b')).toBe('a b');
    expect(cn('a', false, 'b')).toBe('a b');
    expect(cn('', 'a')).toBe('a');
  });

  it('includes object keys with truthy values only', () => {
    expect(cn({ a: true, b: false })).toBe('a');
    expect(cn({ a: true, b: true, c: false })).toBe('a b');
    expect(cn({ foo: true })).toBe('foo');
  });

  it('flattens and processes arrays', () => {
    expect(cn(['a', 'b'])).toBe('a b');
    expect(cn('x', ['a', 'b'])).toBe('x a b');
  });

  it('handles nested cn() in arrays', () => {
    expect(cn(['a', ['b', 'c']])).toBe('a b c');
    expect(cn([['a'], ['b']])).toBe('a b');
  });

  it('handles mixed inputs', () => {
    expect(cn('base', { active: true, disabled: false }, ['extra'])).toBe(
      'base active extra'
    );
    expect(cn('a', null, { b: true }, ['c', 'd'])).toBe('a b c d');
  });
});
