import * as React from 'react';
import { cn } from './cn';
export function Card({ className, interactive = false, selected = false, ...props }: React.ComponentProps<'div'> & { interactive?: boolean; selected?: boolean }) {
  return (
    <div
      {...props}
      data-slot="card"
      data-interactive={interactive || undefined}
      data-state={selected ? 'selected' : undefined}
      className={cn('not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-foreground', interactive && 'transition-[border-color,box-shadow] hover:border-primary-hover hover:shadow-[var(--popup-shadow)] focus-within:border-primary focus-within:outline-2 focus-within:outline-focus-ring focus-within:outline-offset-2', 'rounded-[var(--control-radius-lg)] border border-border bg-card text-[length:var(--control-font-size)] leading-[var(--control-line-height)] text-[var(--control-foreground)]', selected && 'border-primary bg-[var(--nav-active)]', className)}
    />
  );
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-header" className={cn('grid min-h-[calc(var(--control-line-height-lg)+var(--control-spacing)*2)] content-center border-b border-border px-[var(--control-spacing-lg)] py-[var(--control-spacing)]', className)} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-title" className={cn('text-heading-3 font-semibold', className)} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-description" className={cn('text-[length:var(--control-font-size)] leading-[var(--control-line-height)] text-muted-foreground', className)} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-content" className={cn('p-[var(--control-spacing-lg)]', className)} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-footer" className={cn('flex items-center gap-[calc(var(--control-spacing)/2)] border-t border-border px-[var(--control-spacing-lg)] py-[var(--control-spacing-sm)]', className)} />;
}
