import * as React from 'react';
import { ScrollArea as ScrollPrimitive } from 'radix-ui';
import { cn } from './cn';
export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollPrimitive.Scrollbar>) {
  return (
    <ScrollPrimitive.Scrollbar
      {...props}
      orientation={orientation}
      className={cn(
        'flex touch-none select-none p-px',
        orientation === 'vertical' ? 'h-full w-2.5' : 'h-2.5 flex-col',
        className,
      )}
    >
      <ScrollPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
    </ScrollPrimitive.Scrollbar>
  );
}
export function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollPrimitive.Root>) {
  return (
    <ScrollPrimitive.Root {...props} className={cn('relative', className)}>
      <ScrollPrimitive.Viewport className="size-full rounded-[inherit]">{children}</ScrollPrimitive.Viewport>
      <ScrollBar />
      <ScrollPrimitive.Corner />
    </ScrollPrimitive.Root>
  );
}
