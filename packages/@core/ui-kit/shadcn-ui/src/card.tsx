import * as React from 'react';
import { cn } from './cn';
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      {...props}
      data-slot="card"
      className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
    />
  );
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-header" className={cn('grid gap-1.5 p-6', className)} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-title" className={cn('font-semibold leading-none', className)} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-content" className={cn('p-6 pt-0', className)} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="card-footer" className={cn('flex items-center p-6 pt-0', className)} />;
}
