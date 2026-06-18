import { describe, it, expect } from 'vitest';
import { inferPipelineCellSchemas } from '@/lib/pipelineSchemaInference';
import { knownSchema } from '@/lib/inferSchema';
import { generateNodeCode } from '@/lib/codeGenerators';

describe('inferPipelineCellSchemas', () => {
  it('exposes input and output schemas per cell', () => {
    const cols = [
      { name: 'a', type: 'number' as const },
      { name: 'b', type: 'string' as const },
    ];
    const nodeCells = [
      { nodeId: 'ds', nodeType: 'dataSource', code: 'df = pd.read_csv("x")' },
      {
        nodeId: 'f',
        nodeType: 'filter',
        code: generateNodeCode('filter', { column: 'a', operator: 'gt', value: '1' }),
      },
    ];
    const { inputSchemaByCellId, outputSchemaByCellId, diagnosticsByCellId } =
      inferPipelineCellSchemas({
        nodeCells,
        draftCells: [],
        edges: [{ id: 'e', source: 'ds', target: 'f' }],
        nodes: [
          { id: 'ds', type: 'dataSource', position: { x: 0, y: 0 }, data: { columns: cols } },
          { id: 'f', type: 'filter', position: { x: 0, y: 0 }, data: {} },
        ],
        nodeData: { ds: { columns: cols, rows: [] } },
      });

    expect(outputSchemaByCellId.get('ds')).toEqual(knownSchema(cols));
    expect(inputSchemaByCellId.get('f')).toEqual(knownSchema(cols));
    expect(diagnosticsByCellId.get('f')).toEqual([]);
  });
});
