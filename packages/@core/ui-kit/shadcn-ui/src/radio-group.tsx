import * as React from 'react';
import { RadioGroup as RadioPrimitive } from 'radix-ui';
import { cn } from './cn';
export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root {...props} data-slot="radio-group" className={cn('grid gap-2', className)} />;
}
export function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Item> & { name?: string }) {
  return (
    <RadioPrimitive.Item
      {...props}
      data-slot="radio-group-item"
      className={cn(
        'flex size-[var(--control-font-size-lg)] cursor-pointer items-center justify-center rounded-full border border-[var(--control-border)] bg-[var(--control-background)] text-primary-foreground outline-none transition-[background-color,border-color] duration-200 enabled:hover:border-[var(--control-primary)] focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[var(--control-primary-border)] data-[state=checked]:border-[var(--control-primary)] data-[state=checked]:bg-[var(--control-primary)] enabled:data-[state=checked]:hover:border-transparent enabled:data-[state=checked]:hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)] disabled:data-[state=checked]:border-[var(--control-border)] disabled:data-[state=checked]:bg-[var(--control-disabled-background)]',
        className,
      )}
    >
      <RadioPrimitive.Indicator className="size-[calc(var(--control-font-size-lg)-10px)] rounded-full bg-current" />
    </RadioPrimitive.Item>
  );
}
