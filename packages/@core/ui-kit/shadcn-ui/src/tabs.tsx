import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from './cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      {...props}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-1 text-muted-foreground',
        className,
      )}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-[calc(var(--radius)*.75)] px-3 py-1.5 text-[length:var(--workspace-body-font-size)] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground',
        className,
      )}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      {...props}
      className={cn('min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-ring', className)}
    />
  );
}
