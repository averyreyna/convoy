import { Copy, Download, FileCode, Play, Plus, Square, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { label, button } from '@/flank';

interface PipelineCodeToolbarProps {
  canEditWithAI: boolean;
  onToggleEditWithAI: () => void;
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
}

export function PipelineCodeToolbar({
  canEditWithAI,
  onToggleEditWithAI,
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
}: PipelineCodeToolbarProps) {
  return (
    <div className="flex shrink-0 items-center justify-between">
      <span className={label}>Pipeline code</span>
      <div className="flex items-center gap-0.5">
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
        <button
          type="button"
          onClick={onCopyScript}
          disabled={!canCopyScript}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title={copyFeedback === 'script' ? 'Copied' : 'Copy Python script'}
        >
          <Copy size={13} />
          {copyFeedback === 'script' && (
            <span className="text-[9px] font-medium text-emerald-600">Copied</span>
          )}
        </button>
        <button
          type="button"
          onClick={onCopyJupyter}
          disabled={!canCopyJupyter}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title={copyFeedback === 'jupyter' ? 'Copied' : 'Copy as Jupyter cells'}
        >
          <FileCode size={13} />
          {copyFeedback === 'jupyter' && (
            <span className="text-[9px] font-medium text-emerald-600">Copied</span>
          )}
        </button>
        <button
          type="button"
          onClick={onDownloadPy}
          disabled={!canDownloadPy}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title="Download as .py"
        >
          <Download size={13} />
        </button>
        <button
          type="button"
          onClick={onDownloadNotebook}
          disabled={!canDownloadNotebook}
          className={cn(button.base, button.variants.ghost, button.sizes.sm, 'disabled:opacity-50')}
          title="Download as .ipynb"
        >
          .ipynb
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
  );
}
