import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from '@niubu/icons';
import { cn } from './cn';
export function Checkbox({ className, name, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
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
          <CheckboxPrimitive.Indicator>
            <Check size={14} aria-hidden="true" />
          </CheckboxPrimitive.Indicator>
        </button>
      ) : (
        <CheckboxPrimitive.Indicator>
          <Check size={14} aria-hidden="true" />
        </CheckboxPrimitive.Indicator>
      )}
    </CheckboxPrimitive.Root>
  );
}
