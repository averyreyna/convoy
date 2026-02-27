import { useState, useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Code2, Settings2, RotateCcw, CheckCircle2, AlertCircle, Circle, ClipboardPaste, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { segmentControl, segmentControlItem, segmentControlItemSelected } from '@/design-system';
import { generateNodeCode, getEditorLanguage } from '@/lib/codeGenerators';
import { validateSyntax } from '@/lib/codeValidation';
import type { editor as monacoEditor } from 'monaco-editor';

interface CodeViewProps {
  /** The node type (e.g. 'filter', 'groupBy') */
  nodeType: string;
  /** Current node configuration used to generate code */
  config: Record<string, unknown>;
  /** Whether the node is currently showing code view */
  isCodeMode: boolean;
  /** User's custom code (if they've edited the generated code) */
  customCode?: string;
  /** Called when the user toggles between Simple and Code view */
  onToggleMode: () => void;
  /** Called when user edits code in the editor */
  onCodeChange: (code: string) => void;
  /** If true, only show code view (no toggle). Used for Transform nodes. */
  codeOnly?: boolean;
  /** Error message from execution (set by the parent node) */
  executionError?: string;
  /** Column names from upstream data, used for autocomplete */
  upstreamColumns?: string[];
}

type EditorStatus = 'idle' | 'valid' | 'syntax-error' | 'runtime-error';

/**
 * Code view toggle and editor component for nodes.
 * Provides a Simple/Code toggle and a Monaco editor with Python syntax highlighting.
 * Validates code on every keystroke (syntax only) and shows inline errors.
 * When the user edits code, it becomes "custom" and executes via the Python runner.
 */
export function CodeView({
  nodeType,
  config,
  isCodeMode,
  customCode,
  onToggleMode,
  onCodeChange,
  codeOnly = false,
  executionError,
  upstreamColumns,
}: CodeViewProps) {
  const editorLanguage = getEditorLanguage(nodeType);
  const isExecutableCode = editorLanguage === 'python';

  // Generate code from the current config
  const [generatedCode, setGeneratedCode] = useState(() =>
    generateNodeCode(nodeType, config)
  );
  const [hasEdited, setHasEdited] = useState(!!customCode);
  const [syntaxError, setSyntaxError] = useState<string | undefined>();
  const [editorHeight, setEditorHeight] = useState(120);

  // Batch edit mode: edit freely, then Apply to send all changes and run once
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState('');

  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Regenerate code when config changes (only if user hasn't manually edited)
  useEffect(() => {
    if (!hasEdited) {
      setGeneratedCode(generateNodeCode(nodeType, config));
    }
  }, [nodeType, config, hasEdited]);

  const displayCode = customCode || generatedCode;
  const editorValue = isEditMode ? draft : displayCode;

  // Determine status indicator
  let status: EditorStatus = 'idle';
  if (hasEdited && isExecutableCode) {
    if (syntaxError) {
      status = 'syntax-error';
    } else if (executionError) {
      status = 'runtime-error';
    } else {
      status = 'valid';
    }
  }

  // ─── Syntax validation (debounced) ──────────────────────────────────────────
  const validateCode = useCallback(
    (code: string) => {
      if (!isExecutableCode) return;

      const result = validateSyntax(code);
      setSyntaxError(result.valid ? undefined : result.error);

      // Set Monaco markers for squiggly underlines
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (editor && monaco) {
        const model = editor.getModel();
        if (model) {
          if (!result.valid && result.error) {
            const line = result.line ?? 1;
            const col = result.column ?? 1;
            monaco.editor.setModelMarkers(model, 'codeValidation', [
              {
                severity: monaco.MarkerSeverity.Error,
                message: result.error,
                startLineNumber: line,
                startColumn: col,
                endLineNumber: line,
                endColumn: col + 1,
              },
            ]);
          } else {
            monaco.editor.setModelMarkers(model, 'codeValidation', []);
          }
        }
      }
    },
    [isExecutableCode]
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setHasEdited(true);
        onCodeChange(value);

        // Debounced syntax validation
        if (validationTimer.current) {
          clearTimeout(validationTimer.current);
        }
        validationTimer.current = setTimeout(() => {
          validateCode(value);
        }, 300);
      }
    },
    [onCodeChange, validateCode]
  );

  // In edit mode: only update draft and validate; do not run node until Apply
  const handleDraftChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setDraft(value);
        if (validationTimer.current) clearTimeout(validationTimer.current);
        validationTimer.current = setTimeout(() => validateCode(value), 300);
      }
    },
    [validateCode]
  );

  const handleStartEdit = useCallback(() => {
    setDraft(displayCode);
    setIsEditMode(true);
    setSyntaxError(undefined);
  }, [displayCode]);

  const handleApply = useCallback(() => {
    setHasEdited(true);
    onCodeChange(draft);
    setIsEditMode(false);
    validateCode(draft);
    editorRef.current?.focus();
  }, [draft, onCodeChange, validateCode]);

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    setDraft('');
    // Clear validation markers when reverting to saved code
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (editor && monaco) {
      const model = editor.getModel();
      if (model) monaco.editor.setModelMarkers(model, 'codeValidation', []);
    }
  }, []);

  // ─── Paste code from clipboard (Phase 3: paste snippet and iterate) ─────────────
  const handlePasteCode = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setHasEdited(true);
        onCodeChange(text.trim());
        editorRef.current?.focus();
      }
    } catch {
      // Permission denied or clipboard empty — no-op
    }
  }, [onCodeChange]);

  // ─── Reset to generated code ────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setHasEdited(false);
    setSyntaxError(undefined);
    const freshCode = generateNodeCode(nodeType, config);
    setGeneratedCode(freshCode);
    onCodeChange(freshCode);

    // Clear Monaco markers
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (editor && monaco) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, 'codeValidation', []);
      }
    }

    // Switch back to simple mode if not code-only
    if (!codeOnly) {
      onToggleMode();
    }
  }, [nodeType, config, onCodeChange, onToggleMode, codeOnly]);

  // ─── Auto-resize editor height ──────────────────────────────────────────────
  const updateEditorHeight = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const contentHeight = editor.getContentHeight();
    const clamped = Math.min(Math.max(contentHeight, 80), 300);
    setEditorHeight(clamped);
  }, []);

  // ─── Monaco onMount: register autocomplete, compute height ──────────────────
  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Compute initial height
      const contentHeight = editor.getContentHeight();
      setEditorHeight(Math.min(Math.max(contentHeight, 80), 300));

      // Listen for content changes to auto-resize
      editor.onDidContentSizeChange(() => {
        updateEditorHeight();
      });

      // Register column-name autocomplete for Python nodes
      if (isExecutableCode && upstreamColumns && upstreamColumns.length > 0) {
        monaco.languages.registerCompletionItemProvider('python', {
          triggerCharacters: ['.', '[', '"', "'"],
          provideCompletionItems: (model: monacoEditor.ITextModel, position: import('monaco-editor').Position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };
            const suggestions = (upstreamColumns ?? []).map((col) => ({
              label: col,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col,
              range,
              detail: 'column name',
            }));
            return { suggestions };
          },
        });
      }

      // Run initial validation
      if (hasEdited && isExecutableCode) {
        validateCode(editor.getValue());
      }
    },
    [isExecutableCode, upstreamColumns, hasEdited, validateCode, updateEditorHeight]
  );

  // ─── Common editor options ──────────────────────────────────────────────────
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 11,
    lineNumbers: 'off' as const,
    folding: false,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 8, bottom: 8 },
    wordWrap: 'on' as const,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollbar: {
      vertical: 'auto' as const,
      horizontal: 'hidden' as const,
      verticalScrollbarSize: 6,
    },
  };

  // ─── Status indicator ───────────────────────────────────────────────────────
  const renderStatusIndicator = () => {
    if (!hasEdited || !isExecutableCode) return null;

    switch (status) {
      case 'valid':
        return (
          <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-500">
            <CheckCircle2 size={10} />
            Code valid
          </div>
        );
      case 'syntax-error':
        return null; // Error shown in the error panel below
      case 'runtime-error':
        return null; // Error shown in the error panel below
      default:
        return (
          <div className="flex items-center gap-1 text-[9px] font-medium text-gray-400">
            <Circle size={10} />
            Auto-generated
          </div>
        );
    }
  };

  // ─── Error panel ────────────────────────────────────────────────────────────
  const errorMessage = syntaxError || (hasEdited ? executionError : undefined);
  const renderErrorPanel = () => {
    if (!errorMessage) return null;
    return (
      <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[10px] text-red-600">
        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
        <span className="break-all leading-relaxed">{errorMessage}</span>
      </div>
    );
  };

  // ─── Code-only layout (Transform node) ──────────────────────────────────────
  if (codeOnly) {
    return (
      <div className="space-y-2">
        <div
          className={cn(
            'overflow-hidden rounded-md border',
            isEditMode ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
          )}
        >
          <Editor
            height={`${editorHeight}px`}
            language={editorLanguage}
            value={editorValue}
            onChange={isEditMode ? handleDraftChange : handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-light"
            options={editorOptions}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1">
          {!isEditMode && renderStatusIndicator()}
          <div className="flex flex-wrap items-center gap-1">
            {isEditMode ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApply();
                  }}
                  className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                  title="Apply changes and run"
                >
                  <Check size={10} />
                  Apply
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                  title="Discard edits"
                >
                  <X size={10} />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit();
                  }}
                  className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                  title="Edit code and apply in one shot"
                >
                  <Pencil size={10} />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePasteCode();
                  }}
                  className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                  title="Replace editor content with clipboard"
                >
                  <ClipboardPaste size={10} />
                  Paste code
                </button>
                {hasEdited && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                    title="Reset to generated code"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {renderErrorPanel()}
      </div>
    );
  }

  // ─── Standard layout (with Simple/Code toggle) ─────────────────────────────
  return (
    <div className="space-y-2">
      {/* Simple / Code toggle */}
      <div className={segmentControl}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isCodeMode && !hasEdited) onToggleMode();
          }}
          disabled={hasEdited}
          className={cn(
            segmentControlItem,
            'flex flex-1 items-center justify-center gap-1',
            !isCodeMode && segmentControlItemSelected,
            hasEdited && 'cursor-not-allowed text-gray-300'
          )}
        >
          <Settings2 size={12} />
          Simple
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCodeMode) onToggleMode();
          }}
          className={cn(
            segmentControlItem,
            'flex flex-1 items-center justify-center gap-1',
            isCodeMode && segmentControlItemSelected
          )}
        >
          <Code2 size={12} />
          Code
        </button>
      </div>

      {/* Code editor (shown when in code mode) */}
      {isCodeMode && (
        <>
          <div
            className={cn(
              'overflow-hidden rounded-md border',
              isEditMode ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
            )}
          >
            <Editor
              height={`${editorHeight}px`}
              language={editorLanguage}
              value={editorValue}
              onChange={isEditMode ? handleDraftChange : handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-light"
              options={editorOptions}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1">
            {!isEditMode && renderStatusIndicator()}
            <div className="flex flex-wrap items-center gap-1">
              {isEditMode ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApply();
                    }}
                    className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                    title="Apply changes and run"
                  >
                    <Check size={10} />
                    Apply
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelEdit();
                    }}
                    className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                    title="Discard edits"
                  >
                    <X size={10} />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit();
                    }}
                    className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                    title="Edit code and apply in one shot"
                  >
                    <Pencil size={10} />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePasteCode();
                    }}
                    className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                    title="Replace editor content with clipboard"
                  >
                    <ClipboardPaste size={10} />
                    Paste code
                  </button>
                  {hasEdited && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReset();
                      }}
                      className="flex items-center gap-1 text-[9px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                      title="Reset to generated code"
                    >
                      <RotateCcw size={10} />
                      Reset
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {renderErrorPanel()}
        </>
      )}
    </div>
  );
}
