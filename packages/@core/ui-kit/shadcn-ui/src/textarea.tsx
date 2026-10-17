import * as React from 'react';
import { cn } from './cn';
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      data-slot="textarea"
      className={cn(
        'min-h-20 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-[length:max(16px,var(--workspace-body-font-size,0.875rem))] text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-[length:var(--workspace-body-font-size,0.875rem)] dark:aria-invalid:ring-destructive/40',
        className,
      )}
    />
  );
}
