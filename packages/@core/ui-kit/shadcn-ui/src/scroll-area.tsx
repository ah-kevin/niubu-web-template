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
        'flex touch-none select-none p-px transition-colors',
        orientation === 'vertical' ? 'h-full w-[var(--scrollbar-width)]' : 'h-[var(--scrollbar-width)] flex-col',
        className,
      )}
    >
      <ScrollPrimitive.Thumb className="relative flex-1 rounded-full bg-control-strong hover:bg-muted-foreground" />
    </ScrollPrimitive.Scrollbar>
  );
}
export function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollPrimitive.Root>) {
  return (
    <ScrollPrimitive.Root {...props} className={cn('relative min-w-0 max-w-full overflow-hidden', className)}>
      <ScrollPrimitive.Viewport className="size-full rounded-[inherit]">{children}</ScrollPrimitive.Viewport>
      <ScrollBar />
      <ScrollPrimitive.Corner />
    </ScrollPrimitive.Root>
  );
}
