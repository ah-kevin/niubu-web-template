import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from '@niubu/icons';
import { cn } from './cn';
export function Checkbox({ className, name, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const indicator = (
    <CheckboxPrimitive.Indicator className="group/checkbox-indicator flex items-center justify-center">
      <Check size={14} aria-hidden="true" className="hidden group-data-[state=checked]/checkbox-indicator:block" />
      <span aria-hidden="true" className="hidden size-[calc(var(--control-font-size-lg)/2)] bg-current group-data-[state=indeterminate]/checkbox-indicator:block" />
    </CheckboxPrimitive.Indicator>
  );
  return (
    <CheckboxPrimitive.Root
      {...props}
      name={name}
      asChild={name ? true : props.asChild}
      data-slot="checkbox"
      className={cn(
        'size-[calc(var(--control-height)/2)] shrink-0 cursor-pointer rounded-[var(--control-radius-sm)] border border-[var(--control-border)] bg-[var(--control-background)] text-[var(--control-primary)] outline-none transition-[background-color,border-color] duration-200 enabled:hover:border-[var(--control-primary)] focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[var(--control-primary-border)] disabled:cursor-not-allowed disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)] data-[state=checked]:border-[var(--control-primary)] data-[state=checked]:bg-[var(--control-primary)] data-[state=checked]:text-primary-foreground enabled:data-[state=checked]:hover:border-transparent enabled:data-[state=checked]:hover:bg-primary-hover disabled:data-[state=checked]:border-[var(--control-border)] disabled:data-[state=checked]:bg-[var(--control-disabled-background)] disabled:data-[state=checked]:text-[var(--control-disabled-foreground)]',
        className,
      )}
    >
      {name ? (
        <button type="button" name={name}>
          {indicator}
        </button>
      ) : (
        indicator
      )}
    </CheckboxPrimitive.Root>
  );
}
