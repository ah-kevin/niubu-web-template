import * as React from 'react';
import { cn } from './cn';
export function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="pagination" {...props} className={cn('mx-auto flex w-full justify-center', className)} />;
}
export function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul {...props} className={cn('flex items-center gap-0', className)} />;
}
export function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li {...props} />;
}
export function PaginationLink({ className, isActive, ...props }: React.ComponentProps<'a'> & { isActive?: boolean }) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      {...props}
      className={cn(
        'mx-[3px] inline-flex size-[2.15em] min-w-[2.15em] cursor-pointer items-center justify-center rounded-[4px] border border-transparent bg-card p-0 text-[12px] leading-[2em] font-normal text-foreground outline-none transition-colors hover:text-primary focus-visible:border-border focus-visible:bg-accent focus-visible:text-[var(--accent-foreground,var(--foreground))] focus-visible:shadow-[0_0_0_1px_var(--border)] active:border-border active:bg-accent active:text-[var(--accent-foreground,var(--foreground))] active:shadow-[0_0_0_1px_var(--border)]',
        isActive && 'bg-primary font-bold text-primary-foreground hover:text-primary-foreground',
        className,
      )}
    />
  );
}
export function PaginationPrevious({ children = 'Previous', ...props }: React.ComponentProps<'a'>) {
  return (
    <PaginationLink aria-label="Previous page" {...props}>
      {children}
    </PaginationLink>
  );
}
export function PaginationNext({ children = 'Next', ...props }: React.ComponentProps<'a'>) {
  return (
    <PaginationLink aria-label="Next page" {...props}>
      {children}
    </PaginationLink>
  );
}
export function PaginationEllipsis(props: React.ComponentProps<'span'>) {
  return (
    <span aria-hidden {...props}>
      …
    </span>
  );
}
