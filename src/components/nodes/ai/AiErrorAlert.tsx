import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { alert } from '@/flank';

interface AiErrorAlertProps {
  message: string;
}

export function AiErrorAlert({ message }: AiErrorAlertProps) {
  if (!message) return null;

  return (
    <div className={cn(alert, 'flex items-start gap-2')}>
      <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

