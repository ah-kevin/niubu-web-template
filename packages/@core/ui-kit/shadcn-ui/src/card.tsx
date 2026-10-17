import * as React from 'react';
import { cn } from './cn';
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      {...props}
      data-slot="card"
      className={cn('rounded-[var(--radius)] border border-border bg-card text-[length:var(--workspace-body-font-size)] text-card-foreground', className)}
    />
  );
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-header" className={cn('grid gap-1.5 border-b border-border p-[var(--workspace-card-padding)]', className)} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-title" className={cn('text-base font-semibold leading-snug', className)} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-content" className={cn('p-[var(--workspace-card-padding)]', className)} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-footer" className={cn('flex items-center gap-2 border-t border-border p-[var(--workspace-card-padding)]', className)} />;
}
