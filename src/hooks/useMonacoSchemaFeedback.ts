import { useEffect, useRef } from 'react';
import type { Schema, SchemaDiagnostic } from '@/lib/inferSchema';
import {
  applySchemaMarkers,
  clearSchemaMarkers,
  registerSchemaFeedbackModel,
  updateSchemaFeedbackModel,
} from '@/lib/monacoSchemaFeedback';
import type { editor as monacoEditor } from 'monaco-editor';

export interface MonacoSchemaFeedbackParams {
  code: string;
  diagnostics: SchemaDiagnostic[];
  inputSchema: Schema;
  nodeType?: string;
  enabled?: boolean;
}

/**
 * Bind Monaco schema markers and type-directed completion to an editor instance.
 */
export function useMonacoSchemaFeedback(
  editor: monacoEditor.IStandaloneCodeEditor | null,
  monaco: typeof import('monaco-editor') | null,
  params: MonacoSchemaFeedbackParams
): void {
  const unregisterRef = useRef<(() => void) | null>(null);
  const { code, diagnostics, inputSchema, nodeType, enabled = true } = params;

  useEffect(() => {
    if (!editor || !monaco || !enabled) return;
    const model = editor.getModel();
    if (!model) return;

    unregisterRef.current?.();
    unregisterRef.current = registerSchemaFeedbackModel(monaco, model, {
      inputSchema,
      nodeType,
    });

    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
      clearSchemaMarkers(monaco, model);
    };
  }, [editor, monaco, enabled]);

  useEffect(() => {
    if (!editor || !monaco || !enabled) return;
    const model = editor.getModel();
    if (!model) return;

    updateSchemaFeedbackModel(model, { inputSchema, nodeType });
    applySchemaMarkers(monaco, model, code, diagnostics);
  }, [editor, monaco, code, diagnostics, inputSchema, nodeType, enabled]);
}
