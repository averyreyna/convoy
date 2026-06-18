/**
 * Native evaluation of a computed-column expression (Phase 3).
 *
 * Generated pandas is: df["<name>"] = <expression>. We support a restricted but
 * common subset of pandas expressions evaluated per-row:
 *   - column refs:   df["col"] / df['col']
 *   - numeric and string literals
 *   - arithmetic:    + - * / % **  (with parentheses and unary +/-)
 *   - `+` concatenates when both operands are strings (matches object dtype)
 *
 * Anything outside this grammar (method calls like .str.upper(), np.*, function
 * calls, comparisons, etc.) causes evaluation to bail out by returning null, and
 * the caller falls back to the Pyodide runner so behavior stays correct.
 *
 * Missing operands propagate as null (mirroring pandas NaN propagation).
 */

import type { DataFrame, Column } from '@/types';
import type { ComputedColumnConfig } from '@/lib/nodeExecutors/computedColumnExecutor';
import { inferColumnTypeFromValues, isMissing, toNumber } from './dataTypes';

type Cell = number | string | null;

/**
 * Returns the resulting DataFrame, or null if the config is incomplete or the
 * expression uses constructs the native evaluator does not support.
 */
export function computedColumnNative(
  input: DataFrame,
  config: ComputedColumnConfig
): DataFrame | null {
  const { newColumnName, expression } = config;
  if (!newColumnName || !expression || expression.trim() === '') return null;

  let ast: Node;
  try {
    ast = parse(expression);
  } catch {
    return null; // unsupported syntax → fall back to Python
  }

  const values: Cell[] = input.rows.map((row) => evaluate(ast, row));
  const rows = input.rows.map((row, i) => ({ ...row, [newColumnName]: values[i] }));

  const newType = inferColumnTypeFromValues(values);
  const columns: Column[] = input.columns.some((c) => c.name === newColumnName)
    ? input.columns.map((c) => (c.name === newColumnName ? { name: c.name, type: newType } : c))
    : [...input.columns, { name: newColumnName, type: newType }];

  return { columns, rows };
}

// ─── AST ────────────────────────────────────────────────────────────────────

type BinaryOp = '+' | '-' | '*' | '/' | '%' | '**';

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'col'; name: string }
  | { kind: 'unary'; op: '-' | '+'; operand: Node }
  | { kind: 'binary'; op: BinaryOp; left: Node; right: Node };

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'id'; value: string }
  | { type: 'op'; value: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let value = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) {
          value += src[j + 1];
          j += 2;
        } else {
          value += src[j];
          j++;
        }
      }
      if (j >= src.length) throw new Error('Unterminated string literal');
      tokens.push({ type: 'str', value });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, '');
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid number: ${raw}`);
      tokens.push({ type: 'num', value: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ type: 'id', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '*' && src[i + 1] === '*') {
      tokens.push({ type: 'op', value: '**' });
      i += 2;
      continue;
    }
    if ('+-*/%()[]'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

// ─── Parser (recursive descent) ───────────────────────────────────────────────

function parse(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const eat = (): Token => {
    const t = tokens[pos];
    if (!t) throw new Error('Unexpected end of expression');
    pos++;
    return t;
  };
  const expectOp = (value: string): void => {
    const t = eat();
    if (t.type !== 'op' || t.value !== value) throw new Error(`Expected "${value}"`);
  };

  // expr := term (('+'|'-') term)*
  const parseExpr = (): Node => {
    let left = parseTerm();
    let t = peek();
    while (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
      eat();
      left = { kind: 'binary', op: t.value, left, right: parseTerm() };
      t = peek();
    }
    return left;
  };

  // term := power (('*'|'/'|'%') power)*
  const parseTerm = (): Node => {
    let left = parsePower();
    let t = peek();
    while (t && t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
      eat();
      left = { kind: 'binary', op: t.value, left, right: parsePower() };
      t = peek();
    }
    return left;
  };

  // power := unary ('**' power)?   (right-associative)
  const parsePower = (): Node => {
    const base = parseUnary();
    const t = peek();
    if (t && t.type === 'op' && t.value === '**') {
      eat();
      return { kind: 'binary', op: '**', left: base, right: parsePower() };
    }
    return base;
  };

  // unary := ('-'|'+') unary | primary
  const parseUnary = (): Node => {
    const t = peek();
    if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
      eat();
      return { kind: 'unary', op: t.value, operand: parseUnary() };
    }
    return parsePrimary();
  };

  const parsePrimary = (): Node => {
    const t = eat();
    if (t.type === 'num') return { kind: 'num', value: t.value };
    if (t.type === 'str') return { kind: 'str', value: t.value };
    if (t.type === 'op' && t.value === '(') {
      const inner = parseExpr();
      expectOp(')');
      return inner;
    }
    if (t.type === 'id') {
      if (t.value !== 'df') throw new Error(`Unsupported identifier: ${t.value}`);
      expectOp('[');
      const key = eat();
      if (key.type !== 'str') throw new Error('Column reference must be a string');
      expectOp(']');
      return { kind: 'col', name: key.value };
    }
    throw new Error('Unexpected token');
  };

  const node = parseExpr();
  if (pos !== tokens.length) throw new Error('Trailing tokens in expression');
  return node;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

function evaluate(node: Node, row: Record<string, unknown>): Cell {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'str':
      return node.value;
    case 'col': {
      const v = row[node.name];
      if (isMissing(v)) return null;
      return typeof v === 'number' || typeof v === 'string' ? v : String(v);
    }
    case 'unary': {
      const operand = evaluate(node.operand, row);
      const n = toNumber(operand);
      if (n === null) return null;
      return node.op === '-' ? -n : n;
    }
    case 'binary':
      return evalBinary(node.op, evaluate(node.left, row), evaluate(node.right, row));
  }
}

function evalBinary(op: BinaryOp, left: Cell, right: Cell): Cell {
  // String concatenation: pandas object-dtype `+` joins strings elementwise.
  if (op === '+' && typeof left === 'string' && typeof right === 'string') {
    return left + right;
  }
  const a = toNumber(left);
  const b = toNumber(right);
  if (a === null || b === null) return null;
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? null : a / b;
    case '%':
      return b === 0 ? null : a % b;
    case '**':
      return a ** b;
    default:
      return null;
  }
}
