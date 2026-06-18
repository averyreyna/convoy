import type { Edge, Node } from '@xyflow/react';
import type { Column, DataFrame } from '@/types';
import {
  inferSchemaFromCode,
  knownSchema,
  unknownSchema,
  type Schema,
  type SchemaDiagnostic,
} from '@/lib/inferSchema';

export interface PipelineCellForSchema {
  nodeId: string;
  nodeType: string;
  code: string;
}

export interface PipelineSchemaMaps {
  inputSchemaByCellId: Map<string, Schema>;
  outputSchemaByCellId: Map<string, Schema>;
  diagnosticsByCellId: Map<string, SchemaDiagnostic[]>;
}

/**
 * Thread static schema inference down the pipeline graph lineage (parent edges)
 * and draft-cell chain. Shared by Layer 2 diagnostics, Layer 3 Monaco feedback,
 * and Layer 4 live eval.
 */
export function inferPipelineCellSchemas(params: {
  nodeCells: PipelineCellForSchema[];
  draftCells: Array<{ id: string; code: string }>;
  edges: Edge[];
  nodes: Node[];
  nodeData: Record<string, DataFrame | undefined>;
}): PipelineSchemaMaps {
  const { nodeCells, draftCells, edges, nodes, nodeData } = params;
  const parentOf = new Map<string, string>();
  for (const e of edges) parentOf.set(e.target, e.source);

  const inputSchemaByCellId = new Map<string, Schema>();
  const outputSchemaByCellId = new Map<string, Schema>();
  const diagnosticsByCellId = new Map<string, SchemaDiagnostic[]>();

  for (const cell of nodeCells) {
    if (cell.nodeType === 'dataSource') {
      const cols =
        nodeData[cell.nodeId]?.columns ??
        (nodes.find((n) => n.id === cell.nodeId)?.data as { columns?: Column[] } | undefined)
          ?.columns;
      const out = cols?.length ? knownSchema(cols) : unknownSchema;
      inputSchemaByCellId.set(cell.nodeId, unknownSchema);
      outputSchemaByCellId.set(cell.nodeId, out);
      diagnosticsByCellId.set(cell.nodeId, []);
      continue;
    }
    const parentId = parentOf.get(cell.nodeId);
    const input = (parentId && outputSchemaByCellId.get(parentId)) || unknownSchema;
    const { outputSchema, diagnostics: diags } = inferSchemaFromCode(
      input,
      cell.code,
      cell.nodeType
    );
    inputSchemaByCellId.set(cell.nodeId, input);
    outputSchemaByCellId.set(cell.nodeId, outputSchema);
    diagnosticsByCellId.set(cell.nodeId, diags);
  }

  let prev = nodeCells.length
    ? outputSchemaByCellId.get(nodeCells[nodeCells.length - 1].nodeId) ?? unknownSchema
    : unknownSchema;
  for (const draft of draftCells) {
    const { outputSchema, diagnostics: diags } = inferSchemaFromCode(prev, draft.code);
    inputSchemaByCellId.set(draft.id, prev);
    outputSchemaByCellId.set(draft.id, outputSchema);
    diagnosticsByCellId.set(draft.id, diags);
    prev = outputSchema;
  }

  return { inputSchemaByCellId, outputSchemaByCellId, diagnosticsByCellId };
}

export type { CellEvalStatus, CellLiveEval } from './liveEval';
export { evaluateLineageLive, knownSchemaColumnSummary } from './liveEval';
