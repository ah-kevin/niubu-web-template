import type { ComponentProps } from 'react';
import { Button } from '@niubu/shadcn-ui/button';
import { cn } from '@niubu/shadcn-ui/cn';

/** Vben's small VXE toolbar uses density-aware circular controls. */
export function TableToolButton({ label, className, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        'pattern-table-tool size-[var(--control-height)] min-w-[var(--control-height)] rounded-full border-border bg-card p-0 text-[length:var(--control-font-size)] text-foreground shadow-none! hover:bg-muted hover:text-foreground aria-pressed:border-primary aria-pressed:text-primary aria-disabled:cursor-not-allowed [&_svg]:size-[var(--control-icon-size)]',
        className,
      )}
    />
  );
}
