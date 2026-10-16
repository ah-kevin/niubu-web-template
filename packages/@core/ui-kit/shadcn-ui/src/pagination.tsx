import * as React from 'react';
import { cn } from './cn';
export function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="pagination" {...props} className={cn('mx-auto flex w-full justify-center', className)} />;
}
export function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul {...props} className={cn('flex items-center gap-1', className)} />;
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
        'inline-flex size-9 items-center justify-center rounded-md',
        isActive && 'border border-input',
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
