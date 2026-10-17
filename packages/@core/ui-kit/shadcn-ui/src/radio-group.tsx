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
        'flex size-4 items-center justify-center rounded-full border border-input bg-card outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:text-primary',
        className,
      )}
    >
      <RadioPrimitive.Indicator className="size-2 rounded-full bg-current" />
    </RadioPrimitive.Item>
  );
}
