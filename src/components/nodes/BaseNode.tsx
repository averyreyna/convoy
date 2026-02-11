import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { ExplanationPopover } from './ExplanationPopover';
import { CodeView } from './CodeView';

export type NodeState = 'proposed' | 'confirmed' | 'running' | 'error';

interface BaseNodeProps {
  state: NodeState;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  inputs?: number;
  outputs?: number;
  onConfirm?: () => void;
  /** Node type identifier for AI explanation (e.g. 'filter', 'groupBy') */
  nodeType?: string;
  /** Node configuration for AI explanation and code generation */
  nodeConfig?: Record<string, unknown>;
  /** Input row count for AI explanation context */
  inputRowCount?: number;
  /** Output row count for AI explanation context */
  outputRowCount?: number;
  /** Whether the node is currently in code mode */
  isCodeMode?: boolean;
  /** User's custom code (if they've edited the generated code) */
  customCode?: string;
  /** Called when toggling between Simple and Code view */
  onToggleCodeMode?: () => void;
  /** Called when the user edits code in the editor */
  onCodeChange?: (code: string) => void;
  /** If true, the node is code-only (no simple view). Used for Transform node. */
  codeOnly?: boolean;
  /** If true, the node uses a wider layout (e.g. for chart rendering). */
  wide?: boolean;
  /** Execution error message to show in the code editor */
  executionError?: string;
  /** Upstream column names for autocomplete in the code editor */
  upstreamColumns?: string[];
}

export const BaseNode = memo(function BaseNode({
  state,
  title,
  icon,
  children,
  inputs = 1,
  outputs = 1,
  onConfirm,
  nodeType,
  nodeConfig,
  inputRowCount,
  outputRowCount,
  isCodeMode,
  customCode,
  onToggleCodeMode,
  onCodeChange,
  codeOnly,
  wide,
  executionError,
  upstreamColumns,
}: BaseNodeProps) {
  const showExplanation = state === 'confirmed' && nodeType && nodeConfig;
  const showCodeToggle =
    state === 'confirmed' &&
    nodeType &&
    nodeConfig &&
    onToggleCodeMode &&
    onCodeChange;

  return (
    <div
      className={cn(
        'group rounded-lg border-2 bg-white shadow-md transition-all hover:shadow-lg',
        wide ? 'min-w-[520px] max-w-[580px]' : 'min-w-[300px] max-w-[340px]',
        {
          'border-dashed border-gray-300 opacity-60': state === 'proposed',
          'border-solid border-gray-200': state === 'confirmed',
          'border-solid border-red-400 shadow-red-100': state === 'error',
          'animate-pulse border-blue-400 shadow-blue-100': state === 'running',
        }
      )}
    >
      {/* Input handle */}
      {inputs > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-blue-500"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <span className="flex items-center text-gray-500">{icon}</span>
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <div className="ml-auto flex items-center gap-1">
          {showExplanation && (
            <ExplanationPopover
              nodeType={nodeType}
              nodeConfig={nodeConfig}
              inputRowCount={inputRowCount}
              outputRowCount={outputRowCount}
            />
          )}
          {state === 'proposed' && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              Proposed
            </span>
          )}
          {state === 'error' && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
              Error
            </span>
          )}
        </div>
      </div>

      {/* Content: simple controls or code view */}
      <div className="p-3">
        {showCodeToggle && !codeOnly ? (
          <>
            {/* Simple controls (hidden when code mode active) */}
            {!isCodeMode && children}

            {/* Code view toggle + editor */}
            <CodeView
              nodeType={nodeType}
              config={nodeConfig}
              isCodeMode={!!isCodeMode}
              customCode={customCode}
              onToggleMode={onToggleCodeMode}
              onCodeChange={onCodeChange}
              executionError={executionError}
              upstreamColumns={upstreamColumns}
            />
          </>
        ) : codeOnly && showCodeToggle ? (
          /* Code-only node (Transform) */
          <CodeView
            nodeType={nodeType}
            config={nodeConfig}
            isCodeMode={true}
            customCode={customCode}
            onToggleMode={onToggleCodeMode}
            onCodeChange={onCodeChange}
            codeOnly
            executionError={executionError}
            upstreamColumns={upstreamColumns}
          />
        ) : (
          /* No code toggle available — just show children */
          children
        )}
      </div>

      {/* Confirm button for proposed nodes */}
      {state === 'proposed' && onConfirm && (
        <div className="border-t border-gray-100 px-3 py-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="w-full rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          >
            Click to confirm
          </button>
        </div>
      )}

      {/* Output handle */}
      {outputs > 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-blue-500"
        />
      )}
    </div>
  );
});
