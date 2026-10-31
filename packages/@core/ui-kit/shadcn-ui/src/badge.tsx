import * as React from 'react';
import { cn } from './cn';
export type BadgeProps = React.ComponentProps<'span'> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'neutral' | 'primary' | 'success' | 'warning' | 'info' | 'danger';
  count?: number;
} & ({ dot?: false } | { dot: true; 'aria-label': string });
export function Badge({ className, variant = 'default', count, dot = false, children, ...props }: BadgeProps) {
  const color = {
    default: 'border-transparent bg-[var(--nav-active)] text-nav-active-foreground',
    primary: 'border-transparent bg-[var(--nav-active)] text-nav-active-foreground',
    secondary: 'border-transparent bg-muted text-foreground', neutral: 'border-transparent bg-muted text-foreground',
    destructive: 'border-transparent bg-[var(--destructive-soft)] text-destructive-text',
    danger: 'border-transparent bg-[var(--destructive-soft)] text-destructive-text',
    success: 'border-transparent bg-success-soft text-success-text',
    warning: 'border-transparent bg-warning-soft text-warning-text',
    info: 'border-transparent bg-info-soft text-info-text', outline: 'border-input bg-transparent text-foreground',
  }[variant];
  return <span {...props} data-slot="badge" className={cn(
    'inline-flex h-control-badge-height items-center gap-1 rounded-[var(--control-radius-sm)] border px-2 text-caption font-medium whitespace-nowrap', color,
    count !== undefined && 'min-w-[var(--control-badge-height)] justify-center rounded-full border-card bg-destructive px-1 text-destructive-foreground tabular-nums',
    dot && 'size-2 h-2 rounded-full border-0 bg-destructive p-0', className,
  )}>{dot ? <span className="sr-only">{children}</span> : count !== undefined ? (count > 99 ? '99+' : count) : children}</span>;
}
