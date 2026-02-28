import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { button } from '@/flank';

interface AiCallButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  loadingLabel?: string;
  loading: boolean;
}

export function AiCallButton({ label, loadingLabel, loading, className, disabled, ...rest }: AiCallButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      {...rest}
      disabled={isDisabled}
      className={cn(
        button.base,
        button.variants.primary,
        button.sizes.md,
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {loadingLabel ?? label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

