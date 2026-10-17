// Visuals follow Vben playground / Antdv Next 1.5.2; native and Radix behavior is retained.
import * as React from 'react';
import { cn } from './cn';
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      data-slot="textarea"
      className={cn(
        'min-h-[var(--control-height)] w-full min-w-0 max-w-full resize-y align-bottom [@media(hover:none)_and_(pointer:coarse)]:resize-none rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-background)] px-[var(--control-padding-inline)] py-[var(--control-padding-block)] text-[length:var(--control-font-size)] leading-[var(--control-line-height)] font-normal text-[var(--control-foreground)] placeholder:text-[var(--control-placeholder)] outline-none transition-[color,background-color,border-color,box-shadow] duration-200 enabled:hover:border-[var(--control-hover-border)] focus:border-[var(--control-focus-border)] enabled:focus:hover:border-[var(--control-focus-border)] focus:shadow-[var(--control-focus-shadow)] disabled:cursor-not-allowed disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)] aria-invalid:border-destructive aria-invalid:enabled:hover:border-[var(--control-error-hover)] aria-invalid:focus:border-destructive aria-invalid:enabled:focus:hover:border-destructive aria-invalid:focus:shadow-[var(--control-error-focus-shadow)]',
        className,
      )}
    />
  );
}
