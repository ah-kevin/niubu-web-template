import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Minus } from '@niubu/icons';
import { cn } from './cn';
export function Checkbox({ className, name, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const indicator = (
    <CheckboxPrimitive.Indicator className="group/checkbox-indicator flex items-center justify-center">
      <Check size={14} aria-hidden="true" className="hidden group-data-[state=checked]/checkbox-indicator:block" />
      <Minus size={14} aria-hidden="true" className="hidden group-data-[state=indeterminate]/checkbox-indicator:block" />
    </CheckboxPrimitive.Indicator>
  );
  return (
    <CheckboxPrimitive.Root
      {...props}
      name={name}
      asChild={name ? true : props.asChild}
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 rounded border border-input outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
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
