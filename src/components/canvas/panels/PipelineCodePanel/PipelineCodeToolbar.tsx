import { Copy, Download, FileCode, Pin, Play, Plus, Square, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { label, button, captionMuted } from '@/flank';

interface PipelineCodeToolbarProps {
  canEditWithAI: boolean;
  onToggleEditWithAI: () => void;
  canPinSelection: boolean;
  onPinSelection: () => void;
  canRunAll: boolean;
  isRunning: boolean;
  onRunAll: () => void;
  canCopyScript: boolean;
  copyFeedback: 'script' | 'jupyter' | null;
  onCopyScript: () => void;
  canCopyJupyter: boolean;
  onCopyJupyter: () => void;
  canDownloadPy: boolean;
  onDownloadPy: () => void;
  canDownloadNotebook: boolean;
  onDownloadNotebook: () => void;
  onAddCell: () => void;
  /** When true, show "Notebook downloaded. Open in Jupyter or VS Code." below the toolbar. */
  notebookDownloadFeedback?: boolean;
  /** When set, show this hint below the toolbar (e.g. after Copy as Jupyter). */
  copyFeedbackMessage?: string | null;
}

export function PipelineCodeToolbar({
  canEditWithAI,
  onToggleEditWithAI,
  canPinSelection,
  onPinSelection,
  canRunAll,
  isRunning,
  onRunAll,
  canCopyScript,
  copyFeedback,
  onCopyScript,
  canCopyJupyter,
  onCopyJupyter,
  canDownloadPy,
  onDownloadPy,
  canDownloadNotebook,
  onDownloadNotebook,
  onAddCell,
  notebookDownloadFeedback = false,
  copyFeedbackMessage = null,
}: PipelineCodeToolbarProps) {
  const showExportHint =
    notebookDownloadFeedback || (copyFeedbackMessage != null && copyFeedbackMessage !== '');

  return (
    <div className="flex w-full shrink-0 flex-col gap-1">
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={label}>Pipeline code</span>
          <span className={captionMuted}>
            Same order as exported notebook. Edit here or download to open in Jupyter.
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleEditWithAI}
          disabled={!canEditWithAI}
          className={cn(
            button.base,
            button.variants.secondary,
            button.sizes.sm,
            'disabled:opacity-50'
          )}
          title="Edit selected cells with AI"
        >
          <Wand2 size={13} />
          Edit selection with AI
        </button>
        <button
          type="button"
          onClick={onPinSelection}
          disabled={!canPinSelection}
          className={cn(
            button.base,
            button.variants.ghost,
            button.sizes.sm,
            'disabled:opacity-50'
          )}
          title="Set baseline from selected cells (compare changes later)"
        >
          <Pin size={13} />
          Pin selection
        </button>
        <button
          type="button"
          onClick={onRunAll}
          disabled={!canRunAll || isRunning}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
          title="Run all cells and propose nodes"
        >
          {isRunning ? (
            <Square size={11} className="animate-pulse" />
          ) : (
            <Play size={11} />
          )}
          Run all
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDownloadNotebook}
          disabled={!canDownloadNotebook}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title="Download as Jupyter notebook (.ipynb). Open in Jupyter or VS Code."
        >
          <Download size={13} />
          <span className="text-[10px]">Notebook</span>
        </button>
        <button
          type="button"
          onClick={onCopyJupyter}
          disabled={!canCopyJupyter}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title={copyFeedback === 'jupyter' ? 'Copied' : 'Copy as Jupyter cells. Paste in Jupyter or a .py file (Run Cell with # %%).'}
        >
          <FileCode size={13} />
          {copyFeedback === 'jupyter' && (
            <span className="text-[9px] font-medium text-emerald-600">Copied</span>
          )}
        </button>
        <button
          type="button"
          onClick={onCopyScript}
          disabled={!canCopyScript}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title={copyFeedback === 'script' ? 'Copied' : 'Copy as plain Python script'}
        >
          <Copy size={13} />
          {copyFeedback === 'script' && (
            <span className="text-[9px] font-medium text-emerald-600">Copied</span>
          )}
        </button>
        <button
          type="button"
          onClick={onDownloadPy}
          disabled={!canDownloadPy}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title="Download as script (.py)"
        >
          <Download size={13} />
          <span className="text-[10px]">.py</span>
        </button>
        <button
          type="button"
          onClick={onAddCell}
          className={cn(button.base, button.variants.ghost, button.sizes.sm)}
          title="Add new cell (run to create suggested node)"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
    {showExportHint && (
      <p className={captionMuted}>
        {notebookDownloadFeedback
          ? 'Notebook downloaded. Open the file in Jupyter or VS Code.'
          : copyFeedbackMessage}
      </p>
    )}
    </div>
  );
}
