import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { caption } from '@/flank';
import { generateNodeCode } from '@/lib/codeGenerators';

interface NodeCodePreviewProps {
  type: string;
  config: Record<string, unknown>;
  customCode?: string;
  title?: ReactNode;
  className?: string;
}

export function NodeCodePreview({ type, config, customCode, title, className }: NodeCodePreviewProps) {
  const code =
    typeof customCode === 'string' && customCode.trim() !== ''
      ? customCode
      : generateNodeCode(type, config ?? {});

  return (
    <div className={cn('rounded border border-gray-200 bg-gray-50 p-2', className)}>
      {title && <div className="mb-1 font-medium text-gray-700">{title}</div>}
      <div className={caption}>Code</div>
      <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-gray-100 px-1.5 py-1 text-[10px] text-gray-800">
        {code}
      </pre>
    </div>
  );
}

