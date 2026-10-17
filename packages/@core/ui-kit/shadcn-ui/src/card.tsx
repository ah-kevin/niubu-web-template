import * as React from 'react';
import { cn } from './cn';
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      {...props}
      data-slot="card"
      className={cn('rounded-[var(--control-radius-lg)] border border-border bg-card text-[length:var(--control-font-size)] leading-[var(--control-line-height)] text-[var(--control-foreground)]', className)}
    />
  );
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-header" className={cn('grid min-h-[calc(var(--control-line-height-lg)+var(--control-spacing)*2)] content-center border-b border-border px-[var(--control-spacing-lg)] py-[var(--control-spacing)]', className)} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-title" className={cn('text-[length:var(--control-font-size-lg)] font-semibold leading-[var(--control-line-height-lg)]', className)} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-description" className={cn('text-[length:var(--control-font-size)] leading-[var(--control-line-height)] text-[var(--control-secondary-foreground)]', className)} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-content" className={cn('p-[var(--control-spacing-lg)]', className)} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-footer" className={cn('flex items-center gap-[calc(var(--control-spacing)/2)] border-t border-border px-[var(--control-spacing-lg)] py-[var(--control-spacing-sm)]', className)} />;
}
