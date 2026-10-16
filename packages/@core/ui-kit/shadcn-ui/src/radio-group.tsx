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
        'flex size-4 items-center justify-center rounded-full border border-input outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
    >
      <RadioPrimitive.Indicator className="size-2 rounded-full bg-current" />
    </RadioPrimitive.Item>
  );
}
