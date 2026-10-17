import type { ComponentProps } from 'react';
import { Button } from '@niubu/shadcn-ui/button';
import { cn } from '@niubu/shadcn-ui/cn';

/** Vben's small VXE toolbar uses 30px circular controls and 12px icons. */
export function TableToolButton({ label, className, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        'pattern-table-tool size-[30px] min-w-[30px] rounded-full border-border bg-card p-0 text-[12px] text-foreground shadow-none! hover:border-primary hover:bg-card hover:text-primary aria-pressed:border-primary aria-pressed:text-primary aria-disabled:cursor-not-allowed [&_svg]:size-[12px]',
        className,
      )}
    />
  );
}
