import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from './cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      {...props}
      className={cn(
        'inline-flex h-9 w-fit items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
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
        'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground',
        className,
      )}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      {...props}
      className={cn('min-w-0 flex-1 outline-none', className)}
    />
  );
}
