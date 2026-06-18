import type { DataFrame } from '@/types';
import { generateNodeCode } from '@/lib/codeGenerators';
import { executeNodeNative } from '@/lib/nativeExecutors';
import { isConfigComplete } from '@/lib/isConfigComplete';
import {
  classifyCell,
  inferSchema,
  inferSchemaFromCode,
  unknownSchema,
  type Schema,
} from '@/lib/inferSchema';
import { runPythonWithDataFrame } from '@/lib/pythonRunner';

export type CellEvalStatus = 'complete' | 'hole' | 'indeterminate' | 'error';

export interface CellLiveEval {
  status: CellEvalStatus;
  outputSchema: Schema;
  outputPreview?: DataFrame;
  error?: string;
}

export interface LiveEvalCell {
  code: string;
  nodeType?: string;
}

function isHoleCode(code: string): boolean {
  const trimmed = code.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function schemaToDataFrame(schema: Schema): DataFrame {
  if (schema.kind === 'known') {
    return { columns: schema.columns, rows: [] };
  }
  return { columns: [], rows: [] };
}

function dataFrameFromEvalResult(result: DataFrame, outputSchema: Schema): DataFrame {
  if (outputSchema.kind === 'known' && result.rows.length === 0) {
    return { columns: outputSchema.columns, rows: [] };
  }
  return result;
}

async function executeClassifiedCell(
  step: { type: string; config: Record<string, unknown> },
  input: DataFrame,
  code: string
): Promise<DataFrame> {
  const native = step.type !== 'transform' ? executeNodeNative(step.type, input, step.config) : null;
  if (native) return native;

  const execCode =
    step.type === 'transform'
      ? code.trim()
      : generateNodeCode(step.type, step.config);
  return runPythonWithDataFrame(input, execCode, { allowEmptyExecution: true });
}

/**
 * Evaluate a linear cell lineage with hole-aware semantics. Returns per-cell
 * status and schema-known previews without mutating the canvas data store.
 */
export async function evaluateLineageLive(
  cells: LiveEvalCell[],
  rootSchema: Schema,
  options?: {
    upToIndex?: number;
    /** Cached canvas outputs keyed by cell index (skip re-exec when present). */
    realOutputByIndex?: Map<number, DataFrame>;
  }
): Promise<CellLiveEval[]> {
  const end =
    options?.upToIndex !== undefined
      ? Math.min(options.upToIndex + 1, cells.length)
      : cells.length;
  const slice = cells.slice(0, end);
  const results: CellLiveEval[] = [];

  let inputSchema = rootSchema;
  let inputData: DataFrame | undefined;

  for (let i = 0; i < slice.length; i++) {
    const cell = slice[i];
    const cachedOutput = options?.realOutputByIndex?.get(i);
    const evalInput: DataFrame =
      inputData ??
      (inputSchema.kind === 'known' ? schemaToDataFrame(inputSchema) : { columns: [], rows: [] });

    if (cell.nodeType === 'dataSource') {
      const outSchema = inputSchema;
      const preview = cachedOutput ?? inputData ?? schemaToDataFrame(outSchema);
      results.push({
        status: 'complete',
        outputSchema: outSchema,
        outputPreview: preview,
      });
      inputSchema = outSchema;
      inputData = preview;
      continue;
    }

    if (isHoleCode(cell.code)) {
      const preview = cachedOutput ?? inputData ?? schemaToDataFrame(inputSchema);
      results.push({
        status: 'hole',
        outputSchema: inputSchema,
        outputPreview: preview,
      });
      inputData = preview;
      continue;
    }

    const classified = classifyCell(cell.code);
    const knownType = cell.nodeType && cell.nodeType !== 'transform' ? cell.nodeType : undefined;
    const inferred = inferSchemaFromCode(inputSchema, cell.code, knownType);

    if (!classified) {
      const preview = cachedOutput ?? schemaToDataFrame(inferred.outputSchema);
      results.push({
        status: 'indeterminate',
        outputSchema: inferred.outputSchema,
        outputPreview: preview,
      });
      inputSchema = inferred.outputSchema;
      inputData = preview;
      continue;
    }

    if (!isConfigComplete(classified.type, classified.config)) {
      const partial = inferSchema(inputSchema, classified);
      const preview = cachedOutput ?? schemaToDataFrame(partial.outputSchema);
      results.push({
        status: 'indeterminate',
        outputSchema: partial.outputSchema,
        outputPreview: preview,
      });
      inputSchema = partial.outputSchema;
      inputData = preview;
      continue;
    }

    if (cachedOutput) {
      const outputSchema =
        inferred.outputSchema.kind === 'known' ? inferred.outputSchema : unknownSchema;
      results.push({
        status: 'complete',
        outputSchema,
        outputPreview: cachedOutput,
      });
      inputSchema = outputSchema;
      inputData = cachedOutput;
      continue;
    }

    if (inputSchema.kind !== 'known' && evalInput.columns.length === 0) {
      results.push({
        status: 'indeterminate',
        outputSchema: inferred.outputSchema,
        outputPreview: schemaToDataFrame(inferred.outputSchema),
      });
      inputSchema = inferred.outputSchema;
      inputData = undefined;
      continue;
    }

    try {
      const result = await executeClassifiedCell(classified, evalInput, cell.code);
      const outputSchema =
        inferred.outputSchema.kind === 'known' ? inferred.outputSchema : unknownSchema;
      const preview = dataFrameFromEvalResult(result, outputSchema);
      results.push({
        status: 'complete',
        outputSchema,
        outputPreview: preview,
      });
      inputSchema = outputSchema;
      inputData = preview;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      results.push({
        status: 'error',
        outputSchema: inferred.outputSchema,
        outputPreview: schemaToDataFrame(inferred.outputSchema),
        error: message,
      });
      inputSchema = inferred.outputSchema;
      inputData =
        inferred.outputSchema.kind === 'known'
          ? schemaToDataFrame(inferred.outputSchema)
          : undefined;
    }
  }

  return results;
}

export function knownSchemaColumnSummary(schema: Schema): string {
  if (schema.kind !== 'known' || schema.columns.length === 0) return '';
  const names = schema.columns.map((c) => c.name);
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 4).join(', ')} +${names.length - 4}`;
}
