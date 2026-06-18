import type { Column } from '@/types';
import type { Schema } from '@/lib/inferSchema';
import type { SchemaDiagnostic } from '@/lib/inferSchema';
import { resolveDiagnosticSpans, type MarkerSpan } from '@/lib/schemaDiagnosticSpans';
import type { editor as monacoEditor } from 'monaco-editor';

export interface SchemaFeedbackContext {
  inputSchema: Schema;
  nodeType?: string;
}

const modelContext = new Map<string, SchemaFeedbackContext>();
let providerRegistered = false;
let providerDisposable: { dispose: () => void } | null = null;
let consumerCount = 0;

function columnSuggestions(
  monaco: typeof import('monaco-editor'),
  model: monacoEditor.ITextModel,
  position: import('monaco-editor').Position,
  columns: Column[]
) {
  const word = model.getWordUntilPosition(position);
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };

  const line = model.getLineContent(position.lineNumber);
  const before = line.slice(0, position.column - 1);

  const suggestions: import('monaco-editor').languages.CompletionItem[] = columns.map((col) => ({
    label: col.name,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: col.name,
    range,
    detail: col.type,
  }));

  const filterNumeric = /df\[["'][^"']+["']\]\s*(>|<|>=|<=|==|!=)\s*$/;
  const filterString = /df\[["'][^"']+["']\]\s*==\s*$/;
  if (filterNumeric.test(before)) {
    suggestions.push(
      {
        label: '0',
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: '0',
        range,
        detail: 'numeric literal',
      },
      {
        label: '1',
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: '1',
        range,
        detail: 'numeric literal',
      }
    );
  } else if (filterString.test(before)) {
    suggestions.push({
      label: '""',
      kind: monaco.languages.CompletionItemKind.Value,
      insertText: '""',
      range,
      detail: 'string literal',
    });
  }

  return suggestions;
}

function ensureCompletionProvider(monaco: typeof import('monaco-editor')) {
  if (providerRegistered) return;
  providerRegistered = true;
  providerDisposable = monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '[', '"', "'"],
    provideCompletionItems: (model, position) => {
      const ctx = modelContext.get(model.uri.toString());
      if (!ctx || ctx.inputSchema.kind !== 'known') {
        return { suggestions: [] };
      }
      return {
        suggestions: columnSuggestions(monaco, model, position, ctx.inputSchema.columns),
      };
    },
  });
}

export function registerSchemaFeedbackModel(
  monaco: typeof import('monaco-editor'),
  model: monacoEditor.ITextModel,
  context: SchemaFeedbackContext
): () => void {
  ensureCompletionProvider(monaco);
  consumerCount += 1;
  const key = model.uri.toString();
  modelContext.set(key, context);

  return () => {
    modelContext.delete(key);
    consumerCount -= 1;
    if (consumerCount <= 0 && providerDisposable) {
      providerDisposable.dispose();
      providerDisposable = null;
      providerRegistered = false;
      consumerCount = 0;
    }
  };
}

export function updateSchemaFeedbackModel(
  model: monacoEditor.ITextModel,
  context: SchemaFeedbackContext
): void {
  modelContext.set(model.uri.toString(), context);
}

export function applySchemaMarkers(
  monaco: typeof import('monaco-editor'),
  model: monacoEditor.ITextModel,
  code: string,
  diagnostics: SchemaDiagnostic[]
): void {
  const spans = resolveDiagnosticSpans(code, diagnostics);
  monaco.editor.setModelMarkers(
    model,
    'schemaInference',
    spans.map((span: MarkerSpan) => ({
      severity:
        span.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
      message: span.message,
      startLineNumber: span.startLineNumber,
      startColumn: span.startColumn,
      endLineNumber: span.endLineNumber,
      endColumn: span.endColumn,
    }))
  );
}

export function clearSchemaMarkers(
  monaco: typeof import('monaco-editor'),
  model: monacoEditor.ITextModel
): void {
  monaco.editor.setModelMarkers(model, 'schemaInference', []);
}
