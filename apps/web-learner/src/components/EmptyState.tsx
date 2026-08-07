import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'text-center bg-white rounded-2xl border border-gray-100',
        compact ? 'py-10 px-6' : 'py-16 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4',
          compact ? 'w-12 h-12' : 'w-16 h-16',
        )}
      >
        <Icon className={cn('text-gray-300', compact ? 'w-6 h-6' : 'w-8 h-8')} />
      </div>
      <div className="text-gray-600 font-medium mb-1">{title}</div>
      <div className="text-gray-400 text-sm max-w-sm mx-auto">{description}</div>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 rounded-xl">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
