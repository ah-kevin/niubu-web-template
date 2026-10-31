import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Adornments share the input frame without cloning or replacing the native input. */
export function InputGroup({ className, onMouseDown, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      role={props.role ?? 'group'}
      data-slot="input-group"
      className={cn(
        'group/input-group flex h-[var(--control-height)] w-full min-w-0 items-center overflow-hidden rounded-[var(--control-radius)] border border-[var(--control-border)] bg-card text-foreground transition-[border-color,background-color] hover:border-primary-hover focus-within:border-ring focus-within:outline-2 focus-within:outline-focus-ring focus-within:outline-offset-1',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-[var(--control-border)] has-[:disabled]:bg-muted has-[:disabled]:hover:border-[var(--control-border)] has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:hover:border-destructive has-[[aria-invalid=true]]:focus-within:border-destructive has-[[aria-invalid=true]]:focus-within:outline-destructive',
        '[&>[data-slot=input]]:h-full [&>[data-slot=input]]:min-w-0 [&>[data-slot=input]]:flex-1 [&>[data-slot=input]]:rounded-none [&>[data-slot=input]]:border-0! [&>[data-slot=input]]:bg-transparent! [&>[data-slot=input]]:shadow-none! [&>[data-slot=input]]:outline-none!',
        className,
      )}
      onMouseDown={event => {
        onMouseDown?.(event);
        if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
        if (event.target.closest('input,button,a,select,textarea,[contenteditable=true]')) return;
        const input = event.currentTarget.querySelector<HTMLInputElement>('input:not(:disabled)');
        if (input) {
          event.preventDefault();
          input.focus();
        }
      }}
    />
  );
}

export function InputGroupAddon({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      {...props}
      data-slot="input-group-addon"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 px-[var(--control-padding-inline)] text-[length:var(--control-font-size)] text-muted-foreground select-none group-has-[:disabled]/input-group:text-disabled-foreground [&_svg]:size-[var(--control-icon-size)] [&_svg]:shrink-0',
        className,
      )}
    />
  );
}
