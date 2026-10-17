import * as React from 'react';
import { cn } from './cn';
export type BadgeProps = React.ComponentProps<'span'> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
};
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      data-slot="badge"
      className={cn(
        'inline-flex items-center rounded-[var(--control-radius-sm)] border px-[7px] py-0 text-[length:var(--control-font-size-sm)] leading-[var(--control-line-height-sm)] font-normal whitespace-nowrap',
        {
          'border-[var(--control-primary-border)] bg-[var(--control-selected-background)] text-[var(--control-primary)]': variant === 'default',
          'border-[var(--control-border)] bg-[var(--control-fill-alter)] text-[var(--control-foreground)]': variant === 'secondary',
          'border-[var(--control-error-border)] bg-[var(--control-error-background)] text-destructive': variant === 'destructive',
          'border-[var(--control-border)] bg-transparent text-[var(--control-foreground)]': variant === 'outline',
        },
        className,
      )}
    />
  );
}
