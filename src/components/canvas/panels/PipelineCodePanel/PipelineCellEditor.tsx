import { useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import Editor from '@monaco-editor/react';
import type { editor as monacoEditor } from 'monaco-editor';
import { cn } from '@/lib/utils';
import type { Schema, SchemaDiagnostic } from '@/lib/inferSchema';
import type { CellLiveEval } from '@/lib/liveEval';
import { knownSchemaColumnSummary } from '@/lib/liveEval';
import { unknownSchema } from '@/lib/inferSchema';
import { diagnosticsWithoutSpans } from '@/lib/schemaDiagnosticSpans';
import { useMonacoSchemaFeedback } from '@/hooks/useMonacoSchemaFeedback';

const MIN_EDITOR_HEIGHT = 52;
const MAX_EDITOR_HEIGHT = 168;

const EDITOR_OPTIONS = {
  readOnly: false,
  minimap: { enabled: false },
  fontSize: 10,
  lineNumbers: 'off' as const,
  folding: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 4, bottom: 4 },
  wordWrap: 'on' as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: 'auto' as const,
    horizontal: 'hidden' as const,
    verticalScrollbarSize: 6,
  },
} as const;

function EvalStatusChip({ evalState }: { evalState?: CellLiveEval }) {
  if (!evalState) return null;

  const colCount =
    evalState.outputPreview?.columns.length ??
    (evalState.outputSchema.kind === 'known' ? evalState.outputSchema.columns.length : 0);
  const rowCount = evalState.outputPreview?.rows.length ?? 0;
  const schemaSummary = knownSchemaColumnSummary(evalState.outputSchema);

  let label = '';
  let className = 'text-gray-500 bg-gray-50';

  switch (evalState.status) {
    case 'hole':
      label =
        colCount > 0
          ? `Passthrough · ${colCount} col${colCount === 1 ? '' : 's'}`
          : 'Passthrough';
      className = 'text-gray-600 bg-gray-50';
      break;
    case 'indeterminate':
      label = schemaSummary ? `Schema known · ${schemaSummary}` : 'Schema indeterminate';
      className = 'text-amber-700 bg-amber-50';
      break;
    case 'complete':
      label = `${rowCount} row${rowCount === 1 ? '' : 's'} · ${colCount} col${colCount === 1 ? '' : 's'}`;
      className = 'text-emerald-700 bg-emerald-50';
      break;
    case 'error':
      label = evalState.error
        ? evalState.error.slice(0, 80) + (evalState.error.length > 80 ? '…' : '')
        : 'Eval error';
      className = 'text-red-700 bg-red-50';
      break;
  }

  return (
    <div
      className={cn(
        'border-t border-gray-100 px-2 py-0.5 text-[10px] leading-snug',
        className
      )}
      title={evalState.error ?? schemaSummary}
    >
      {label}
    </div>
  );
}

interface PipelineCellEditorProps {
  cellId: string;
  code: string;
  nodeType: string;
  diagnostics: SchemaDiagnostic[];
  inputSchema: Schema;
  evalState?: CellLiveEval;
  onActivateCell: () => void;
  onClearFocusedCell: () => void;
  onCodeChange: (code: string) => void;
}

function PipelineCellEditor({
  code,
  nodeType,
  diagnostics,
  inputSchema,
  evalState,
  onActivateCell,
  onClearFocusedCell,
  onCodeChange,
}: PipelineCellEditorProps) {
  const [editor, setEditor] = useState<monacoEditor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof import('monaco-editor') | null>(null);
  const fallbackDiagnostics = diagnosticsWithoutSpans(code, diagnostics);

  useMonacoSchemaFeedback(editor, monaco, {
    code,
    diagnostics,
    inputSchema,
    nodeType,
  });

  const handleMount: OnMount = (ed, monacoInstance) => {
    setEditor(ed);
    setMonaco(monacoInstance);
    const disposableFocus = ed.onDidFocusEditorWidget(() => onActivateCell());
    const disposableBlur = ed.onDidBlurEditorWidget(() => onClearFocusedCell());
    return () => {
      disposableFocus.dispose();
      disposableBlur.dispose();
    };
  };

  return (
    <>
      <div className="overflow-hidden rounded-b-md border-0 border-gray-200">
        <Editor
          height={Math.min(
            Math.max(MIN_EDITOR_HEIGHT, code.split('\n').length * 16),
            MAX_EDITOR_HEIGHT
          )}
          language="python"
          value={code}
          onChange={(value) => onCodeChange(value ?? '')}
          theme="vs-light"
          options={EDITOR_OPTIONS}
          onMount={handleMount}
        />
      </div>
      <EvalStatusChip evalState={evalState} />
      {fallbackDiagnostics.length > 0 && (
        <div className="space-y-0.5 border-t border-gray-100 px-2 py-1">
          {fallbackDiagnostics.map((d, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-1 text-[10px] leading-snug',
                d.severity === 'error' ? 'text-red-600' : 'text-amber-600'
              )}
              title={d.severity === 'error' ? 'Schema error' : 'Schema warning'}
            >
              <span aria-hidden>{d.severity === 'error' ? '⨯' : '⚠'}</span>
              <span className="min-w-0 flex-1 break-words">{d.message}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export { PipelineCellEditor, EvalStatusChip, EDITOR_OPTIONS };
