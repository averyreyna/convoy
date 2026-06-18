import { describe, it, expect } from 'vitest';
import { buildNodeExecKey, buildPassThroughKey } from '@/lib/nodeExecutionKey';
import type { DataFrame } from '@/types';

function makeFrame(rows: Record<string, unknown>[], columns = ['a']): DataFrame {
  return {
    columns: columns.map((name) => ({ name, type: 'string' as const })),
    rows,
  };
}

describe('buildNodeExecKey', () => {
  it('changes when upstream version bumps even if row count and columns match', () => {
    const upstream = makeFrame([{ a: '1' }, { a: '2' }]);
    const base = {
      config: { column: 'a' },
      customCode: undefined,
      upstreamData: upstream,
      runRequest: 0,
    };
    const v1 = buildNodeExecKey({ ...base, upstreamVersion: 1 });
    const v2 = buildNodeExecKey({ ...base, upstreamVersion: 2 });
    expect(v1).not.toBe(v2);
  });

  it('changes when config changes', () => {
    const upstream = makeFrame([{ a: '1' }]);
    const shared = {
      customCode: undefined,
      upstreamVersion: 1,
      upstreamData: upstream,
      runRequest: 0,
    };
    const a = buildNodeExecKey({ ...shared, config: { column: 'a' } });
    const b = buildNodeExecKey({ ...shared, config: { column: 'b' } });
    expect(a).not.toBe(b);
  });
});

describe('buildPassThroughKey', () => {
  it('includes upstream version in the passthrough dedupe key', () => {
    const frame = makeFrame([{ a: '1' }]);
    expect(buildPassThroughKey(1, frame)).not.toBe(buildPassThroughKey(2, frame));
  });
});
