import * as React from 'react';
import { cn } from './cn';
export function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="pagination" {...props} className={cn('mx-auto flex w-full justify-center', className)} />;
}
export function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul {...props} className={cn('flex flex-wrap items-center gap-2', className)} />;
}
export function PaginationItem(props: React.ComponentProps<'li'>) { return <li {...props} />; }
export type PaginationLinkProps = React.ComponentProps<'a'> & { isActive?: boolean; disabled?: boolean };
export function PaginationLink({ className, isActive, disabled, onClick, tabIndex, ...props }: PaginationLinkProps) {
  const unavailable = disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true';
  return <a {...props} aria-current={isActive ? 'page' : props['aria-current']} aria-disabled={unavailable || undefined}
    tabIndex={unavailable ? -1 : tabIndex} onClick={event => { if (unavailable) { event.preventDefault(); return; } onClick?.(event); }}
    className={cn('inline-flex h-[var(--control-height)] min-w-[var(--control-height)] items-center justify-center rounded-[var(--control-radius)] border border-transparent bg-transparent px-2 text-[length:var(--control-font-size)] text-foreground tabular-nums outline-none transition-colors hover:bg-muted active:bg-border focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 aria-disabled:cursor-not-allowed aria-disabled:text-disabled-foreground aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent',
      isActive && 'border-primary font-medium text-primary-text active:bg-[var(--nav-active)]', className)} />;
}
export function PaginationPrevious({ children = 'Previous', ...props }: PaginationLinkProps) {
  return <PaginationLink aria-label="Previous page" {...props}>{children}</PaginationLink>;
}
export function PaginationNext({ children = 'Next', ...props }: PaginationLinkProps) {
  return <PaginationLink aria-label="Next page" {...props}>{children}</PaginationLink>;
}
export function PaginationEllipsis(props: React.ComponentProps<'span'>) { return <span aria-hidden {...props}>…</span>; }
