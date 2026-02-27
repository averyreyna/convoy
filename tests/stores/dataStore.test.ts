import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDataStore,
  type NodeDataPayload,
} from '@/stores/dataStore';
import type { Column, DataFrame } from '@/types';

function makeColumns(names: string[]): Column[] {
  return names.map((name) => ({ name, type: 'string' as const }));
}

function makePayload(nodeId: string, rowCount: number): NodeDataPayload {
  return {
    fileName: 'test.csv',
    rowCount,
    columns: makeColumns(['a', 'b']),
    rows: [{ a: '1', b: '2' }],
  };
}

function makeDataFrame(columns: string[], rows: Record<string, unknown>[]): DataFrame {
  return {
    columns: makeColumns(columns),
    rows,
  };
}

describe('dataStore', () => {
  beforeEach(() => {
    useDataStore.getState().clearNodeOutputs();
    useDataStore.setState({ nodeData: {} });
  });

  describe('setNodeData / getNodeData', () => {
    it('stores and retrieves node data by node id', () => {
      const payload = makePayload('n1', 10);
      useDataStore.getState().setNodeData('n1', payload);
      expect(useDataStore.getState().getNodeData('n1')).toEqual(payload);
    });

    it('returns undefined for missing node id', () => {
      expect(useDataStore.getState().getNodeData('missing')).toBeUndefined();
    });
  });

  describe('removeNodeData', () => {
    it('removes data for the given node id', () => {
      useDataStore.getState().setNodeData('n1', makePayload('n1', 5));
      useDataStore.getState().removeNodeData('n1');
      expect(useDataStore.getState().getNodeData('n1')).toBeUndefined();
    });
  });

  describe('setNodeOutput / getNodeOutput', () => {
    it('stores and retrieves dataframe output by node id', () => {
      const df = makeDataFrame(['x'], [{ x: 1 }]);
      useDataStore.getState().setNodeOutput('n1', df);
      expect(useDataStore.getState().getNodeOutput('n1')).toEqual(df);
    });

    it('returns undefined for missing node id', () => {
      expect(useDataStore.getState().getNodeOutput('missing')).toBeUndefined();
    });
  });

  describe('removeNodeOutput', () => {
    it('removes output for the given node id', () => {
      useDataStore.getState().setNodeOutput('n1', makeDataFrame(['a'], []));
      useDataStore.getState().removeNodeOutput('n1');
      expect(useDataStore.getState().getNodeOutput('n1')).toBeUndefined();
    });
  });

  describe('clearNodeOutputs', () => {
    it('clears all node outputs', () => {
      useDataStore.getState().setNodeOutput('n1', makeDataFrame(['a'], []));
      useDataStore.getState().setNodeOutput('n2', makeDataFrame(['b'], []));
      useDataStore.getState().clearNodeOutputs();
      expect(useDataStore.getState().getNodeOutput('n1')).toBeUndefined();
      expect(useDataStore.getState().getNodeOutput('n2')).toBeUndefined();
    });
  });
});
