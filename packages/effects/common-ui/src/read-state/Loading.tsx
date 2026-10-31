import { useTranslation } from '@niubu/locales/react';
import type { ComponentProps } from 'react';
import { cn } from '@niubu/shadcn-ui/cn';

export function Spinner({
  size = 'md',
  label,
  className,
  ...props
}: ComponentProps<'span'> & { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span
      {...props}
      className={cn('pattern-spinner', className)}
      data-size={size}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** A local loading surface; it does not start, delay or declare completion of a request. */
export function Loading({ label, size = 'md' }: { label?: string; size?: 'sm' | 'md' | 'lg' } = {}) {
  const { t } = useTranslation();
  const text = label ?? t('common:read.loading.title');
  return (
    <div className="pattern-loading" role="status" aria-label={text} aria-live="polite" aria-busy="true">
      <Spinner size={size} />
      <span className="pattern-loading-label">{text}</span>
    </div>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" {...props} className={cn('pattern-skeleton', className)} />;
}

/** Omitting value shows an indeterminate task; finite values are clamped to a percentage. */
export function Progress({ value, label, className }: { value?: number; label: string; className?: string }) {
  if (value !== undefined && !Number.isFinite(value)) throw new Error('Progress value must be finite');
  const progress = value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('pattern-progress', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      data-state={progress === undefined ? 'indeterminate' : 'determinate'}
    >
      <span
        className="pattern-progress-indicator"
        style={progress === undefined ? undefined : { width: `${progress}%` }}
      />
    </div>
  );
}
