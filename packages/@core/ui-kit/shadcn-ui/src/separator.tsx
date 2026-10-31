import * as React from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      {...props}
      decorative={decorative}
      orientation={orientation}
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
    />
  );
}

export function Divider({ children, className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  if (children && orientation === 'horizontal') return <SeparatorPrimitive.Root {...props} decorative={false} orientation="horizontal" className={cn('my-4 flex items-center gap-3 text-caption text-muted-foreground', className)}>
    <Separator className="flex-1" /><span>{children}</span><Separator className="flex-1" />
  </SeparatorPrimitive.Root>;
  return <Separator {...props} orientation={orientation} className={cn(orientation === 'horizontal' ? 'my-4' : 'mx-3', className)} />;
}
