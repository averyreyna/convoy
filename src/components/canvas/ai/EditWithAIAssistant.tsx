import { Wand2, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  button,
  modalPanel,
  headingSm,
  caption,
  input,
  alert,
  spinner,
  iconWell,
} from '@/flank';

export interface EditWithAIAssistantProps {
  selectedCount: number;
  editPrompt: string;
  setEditPrompt: (value: string) => void;
  editLoading: boolean;
  editError: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export function EditWithAIAssistant({
  selectedCount,
  editPrompt,
  setEditPrompt,
  editLoading,
  editError,
  onClose,
  onSubmit,
}: EditWithAIAssistantProps) {
  return (
    <div
      className={cn(modalPanel, 'w-full max-w-md p-4')}
      role="dialog"
      aria-label={`Edit ${selectedCount} selected node${selectedCount !== 1 ? 's' : ''} with AI`}
      aria-describedby="edit-with-ai-caption"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(iconWell, 'h-8 w-8')}>
            <Wand2 className="text-blue-500" size={18} />
          </div>
          <div>
            <h2 className={headingSm}>Edit with AI</h2>
            <p id="edit-with-ai-caption" className={caption}>
              Describe how to change the {selectedCount} selected node{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(button.base, button.variants.ghost, button.sizes.sm)}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
      <textarea
        value={editPrompt}
        onChange={(e) => {
          setEditPrompt(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="e.g., Change the filter to use column X and value Y..."
        className={cn(input.default, 'mb-3 h-20 resize-none text-sm')}
        disabled={editLoading}
        autoFocus
      />
      {editError && (
        <div className={cn(alert, 'mb-3 flex items-start gap-2')}>
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="text-xs">{editError}</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={editLoading}
          className={cn(button.base, button.variants.secondary, button.sizes.md, 'disabled:opacity-50')}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!editPrompt.trim() || editLoading}
          className={cn(button.base, button.variants.primary, button.sizes.md, 'disabled:cursor-not-allowed disabled:opacity-50')}
        >
          {editLoading ? (
            <>
              <div className={cn(spinner, 'border-white/30 border-t-white')} />
              Applying...
            </>
          ) : (
            'Apply'
          )}
        </button>
      </div>
    </div>
  );
}
