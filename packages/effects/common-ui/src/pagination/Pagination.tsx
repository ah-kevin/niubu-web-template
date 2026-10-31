import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Select } from '@niubu/shadcn-ui/select';

export interface PaginationLabels {
  pageSize?: string;
  pageSizeOption?: (size: number) => string;
  page?: (page: number, count: number) => string;
  pageNumber?: (page: number) => string;
  firstPage?: string;
  lastPage?: string;
  previousPage?: string;
  nextPage?: string;
  previousPages?: string;
  nextPages?: string;
  total?: (count: number) => string;
}
export interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  total?: number;
  disabled?: boolean;
  simple?: boolean;
  label?: string;
  labels?: PaginationLabels;
}

/** A controlled pager shared by stand-alone lists and DataTable. */
export function Pagination({
  pageIndex,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100, 200],
  total,
  disabled = false,
  simple = false,
  label,
  labels = {},
}: PaginationProps) {
  const { t } = useTranslation();
  const count = Math.max(1, pageCount);
  const current = Math.min(count, Math.max(1, pageIndex + 1));
  const [draft, setDraft] = useState({ page: current, text: String(current) });
  if (draft.page !== current) setDraft({ page: current, text: String(current) });
  const jump = draft.page === current ? draft.text : String(current);
  const setJump = (text: string) => setDraft({ page: current, text });
  const windowSize = count > 7 ? 5 : 7;
  const start = count > 7 ? (current >= count - 2 ? Math.max(count - windowSize + 1, 1) : Math.max(current - 2, 1)) : 1;
  const pages = Array.from({ length: Math.min(windowSize, count) }, (_, index) => start + index);
  const go = (page: number) => {
    const next = Math.min(count, Math.max(1, page));
    if (!disabled && next !== current) onPageChange(next - 1);
  };
  const commitJump = () => {
    const value = Number(jump);
    const next = jump.trim() && Number.isInteger(value) ? Math.min(count, Math.max(1, value)) : current;
    setJump(String(next));
    go(next);
  };
  const control = (name: string, content: ReactNode, unavailable: boolean, action: () => void) => (
    <Button
      variant="ghost"
      type="button"
      className="pattern-page-button"
      aria-label={name}
      title={name}
      disabled={disabled || unavailable}
      onClick={action}
    >
      {content}
    </Button>
  );
  const pageText = labels.page?.(current, count) ?? t('common:table.page', { page: current, count });
  return (
    <nav
      className="pattern-pagination flex min-h-[36px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-1 text-[12px]"
      aria-label={label ?? t('common:table.pagination')}
    >
      {total !== undefined && !simple && (
        <span>{labels.total?.(total) ?? t('common:table.total', { count: total })}</span>
      )}
      {!simple && onPageSizeChange && (
        <Select
          className="pattern-page-size me-auto h-[28px] w-auto min-w-24 px-2 text-[12px]"
          label={labels.pageSize ?? t('common:table.pageSize')}
          value={String(pageSize)}
          disabled={disabled}
          onValueChange={value => onPageSizeChange(Number(value))}
          options={[...new Set([...pageSizeOptions, pageSize])]
            .sort((a, b) => a - b)
            .map(size => ({
              value: String(size),
              label: labels.pageSizeOption?.(size) ?? t('common:table.pageSizeOption', { size }),
            }))}
        />
      )}
      {!simple && (
        <span className="sr-only" aria-live="polite">
          {pageText}
        </span>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-y-2">
        {!simple &&
          control(
            labels.firstPage ?? t('common:table.first'),
            <span aria-hidden="true" className="inline-flex items-center">
              <span className="h-[12px] border-s border-current" />
              <ChevronLeft className="size-[12px]" />
            </span>,
            current === 1,
            () => go(1),
          )}
        {!simple &&
          control(
            labels.previousPages ?? t('common:table.previousPages'),
            <ChevronsLeft aria-hidden="true" className="size-[12px]" />,
            current === 1,
            () => go(current - windowSize),
          )}
        {control(
          labels.previousPage ?? t('common:table.previous'),
          <ChevronLeft aria-hidden="true" className="size-[12px]" />,
          current === 1,
          () => go(current - 1),
        )}
        {simple && <span aria-live="polite">{pageText}</span>}
        {!simple &&
          pages.map(page => (
            <Button
              key={page}
              variant="ghost"
              type="button"
              className="pattern-page-button"
              disabled={disabled}
              aria-label={labels.pageNumber?.(page) ?? t('common:table.pageNumber', { page })}
              aria-current={page === current ? 'page' : undefined}
              onClick={() => go(page)}
            >
              {page}
            </Button>
          ))}
        {control(
          labels.nextPage ?? t('common:table.next'),
          <ChevronRight aria-hidden="true" className="size-[12px]" />,
          current === count,
          () => go(current + 1),
        )}
        {!simple &&
          control(
            labels.nextPages ?? t('common:table.nextPages'),
            <ChevronsRight aria-hidden="true" className="size-[12px]" />,
            current === count,
            () => go(current + windowSize),
          )}
        {!simple &&
          control(
            labels.lastPage ?? t('common:table.last'),
            <span aria-hidden="true" className="inline-flex items-center">
              <ChevronRight className="size-[12px]" />
              <span className="h-[12px] border-s border-current" />
            </span>,
            current === count,
            () => go(count),
          )}
      </div>
      {!simple && (
        <label className="flex items-center gap-2">
          {t('common:table.goTo')}
          <Input
            className="w-14 text-center"
            type="number"
            min={1}
            max={count}
            inputMode="numeric"
            aria-label={t('common:table.jumpToPage')}
            value={jump}
            disabled={disabled}
            onChange={event => setJump(event.target.value)}
            onBlur={commitJump}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitJump();
              }
            }}
          />
          {t('common:table.pageUnit')}
        </label>
      )}
    </nav>
  );
}
