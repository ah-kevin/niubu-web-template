import * as React from 'react';
import { cn } from './cn';
export type BadgeProps = React.ComponentProps<'span'> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
};
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      data-slot="badge"
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        {
          'border-transparent bg-primary text-primary-foreground': variant === 'default',
          'border-transparent bg-secondary text-secondary-foreground': variant === 'secondary',
          'border-transparent bg-destructive text-white': variant === 'destructive',
          'text-foreground': variant === 'outline',
        },
        className,
      )}
    />
  );
}
