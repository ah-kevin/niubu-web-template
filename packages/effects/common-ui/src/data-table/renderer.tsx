import { columnAlignment } from './alignment';
import { Loading, ReadState, Skeleton } from '../read-state';
import { nativeTableClassName } from './table-class-names';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Select } from '@niubu/shadcn-ui/select';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { rowActivation } from './row-activation';
import {
  Fragment,
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Column, Header, ReactTable, Row, RowData } from '@tanstack/react-table';
import type { listFeatures, selectableListFeatures, treeFeatures } from './profiles';
import type { TableAlignment, BaseTableProps, ListSlices, TableLabels, TreeListTableProps } from './types';
import { cn } from '@niubu/shadcn-ui/cn';
import type { ListNativeTable, PresentationTable } from './ColumnSettings';
import { TableToolbar } from './TableToolbar';

export function ReadMessage<T>({
  props,
  hasRows,
}: {
  props: BaseTableProps<T>;
  hasRows: boolean;
}): ReactElement | null {
  const { labels } = props;
  const { t } = useTranslation();
  if (props.readState === 'cancelled')
    return (
      <div className="px-[18px] py-[32px]" role="status">
        {labels.cancelled ?? t('common:table.cancelled')}
        {props.emptyAction}
      </div>
    );
  if (props.readState === 'pending' && props.statePresentation === 'feedback')
    return (
      <>
        <Loading label={labels.pending} />
        <div className="grid gap-3 p-4" aria-hidden="true">
          {[0, 1, 2].map(row => (
            <Skeleton key={row} className="h-[var(--row-height)] w-full" />
          ))}
        </div>
      </>
    );
  if (props.readState === 'error' && props.statePresentation === 'feedback')
    return (
      <div className="pattern-read-feedback">
        <ReadState
          status="error"
          message={labels.error === t('common:read.error.title') ? undefined : labels.error}
          actions={props.emptyAction ?? null}
        />
      </div>
    );
  if (props.readState === 'pending')
    return (
      <div className="px-[18px] py-[32px]" role="status" aria-busy="true">
        {labels.pending}
        <div className="mt-3 grid gap-3" aria-hidden="true">
          {[0, 1, 2].map(row => (
            <Skeleton key={row} className="h-[var(--row-height)] w-full" />
          ))}
        </div>
      </div>
    );
  if (props.readState === 'error')
    return (
      <div className="px-[18px] py-[32px]" role="alert">
        {labels.error}
        {props.emptyAction}
      </div>
    );
  if (hasRows) return null;
  const message =
    props.sourceCount === 0
      ? labels.sourceEmpty
      : props.resultCount !== null && props.resultCount > 0
        ? labels.pageEmpty
        : props.sourceCount === null
          ? labels.sourceUnknown
          : labels.filteredEmpty;
  return (
    <ReadState
      status={props.sourceCount === 0 ? 'source-empty' : 'empty'}
      title={message}
      message=""
      compact
      actions={props.emptyAction ?? null}
    />
  );
}
export const SelectionCheckbox = memo(function SelectionCheckbox({
  selected,
  indeterminate = false,
  disabled,
  label,
  onChange,
}: {
  selected: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label={label}
      disabled={disabled}
      checked={indeterminate ? 'indeterminate' : selected}
      onCheckedChange={checked => onChange(checked === true)}
    />
  );
});
function pinnedStyle<T extends RowData>(
  column: Column<typeof listFeatures, T> | Column<typeof selectableListFeatures, T> | Column<typeof treeFeatures, T>,
): CSSProperties {
  const pin = column.getIsPinned();
  const width = column.getSize();
  return {
    width,
    minWidth: width,
    maxWidth: width,
    position: pin ? 'sticky' : undefined,
    insetInlineStart: pin === 'start' ? column.getStart('start') : undefined,
    insetInlineEnd: pin === 'end' ? column.getAfter('end') : undefined,
    zIndex: pin ? 2 : undefined,
    background: pin ? 'var(--table-row-background, var(--card, Canvas))' : undefined,
  };
}
type ListNativeHeader<T extends RowData> =
  Header<typeof listFeatures, T> | Header<typeof selectableListFeatures, T> | Header<typeof treeFeatures, T>;

/** Only native header layout/actions are shared; the concrete owner supplies FlexRender. */
function HeaderView<T extends RowData>({
  header,
  labels,
  children,
  alignment,
  disabled,
}: {
  header: ListNativeHeader<T>;
  disabled?: boolean;
  labels: TableLabels;
  children: ReactNode;
  alignment: TableAlignment;
}) {
  const column = header.column;
  const sorted = column.getIsSorted();
  const name = labels.columnName(column.id);
  const width = header.getSize();
  return (
    <th
      data-fixed={column.getIsPinned() || undefined}
      data-fixed-edge={
        column.getIsPinned() === 'start'
          ? column.getAfter('start') === 0 || undefined
          : column.getIsPinned() === 'end'
            ? column.getStart('end') === 0 || undefined
            : undefined
      }
      scope={header.colSpan > 1 ? 'colgroup' : 'col'}
      colSpan={header.colSpan}
      style={{ ...pinnedStyle(column), width, minWidth: width, maxWidth: width, textAlign: alignment }}
      aria-sort={
        column.getCanSort() ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined
      }
    >
      {!header.isPlaceholder &&
        (column.getCanSort() ? (
          <Button
            className={cn(
              'h-auto w-full min-w-0 gap-1 p-0 text-[length:var(--control-font-size)] text-inherit [font-weight:inherit] [&_svg]:size-[12px]',
              alignment === 'start'
                ? 'justify-start pe-6 text-start'
                : alignment === 'center'
                  ? 'justify-center px-6 text-center'
                  : 'justify-end px-6 text-end',
            )}
            variant="ghost"
            type="button"
            disabled={disabled}
            aria-label={labels.sortColumn(name)}
            title={name}
            onClick={column.getToggleSortingHandler()}
          >
            <span className="min-w-0 truncate">{children}</span>
            {sorted === 'asc' ? (
              <ArrowUp aria-hidden="true" className="text-primary-text" />
            ) : sorted === 'desc' ? (
              <ArrowDown aria-hidden="true" className="text-primary-text" />
            ) : (
              <span aria-hidden="true" className="inline-flex text-disabled-foreground opacity-45 [&_svg]:size-[12px]">
                <ArrowUp />
                <ArrowDown />
              </span>
            )}
          </Button>
        ) : (
          children
        ))}
      {column.getCanResize() && (
        <Button
          variant="ghost"
          type="button"
          className="pattern-column-resizer rounded-none p-0"
          disabled={disabled}
          aria-label={labels.resizeColumn(name)}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const delta = event.key === 'ArrowRight' ? 10 : -10;
            // Native getLeafHeaders also returns group ancestors. Commit actual resizable leaves only.
            const widths = header
              .getLeafHeaders()
              .filter(
                leaf => leaf.subHeaders.length === 0 && leaf.column.columns.length === 0 && leaf.column.getCanResize(),
              )
              .map(leaf => [
                leaf.column.id,
                Math.min(
                  leaf.column.columnDef.maxSize ?? 640,
                  Math.max(leaf.column.columnDef.minSize ?? 80, leaf.column.getSize() + delta),
                ),
              ]);
            header.table.setColumnSizing(previous => ({ ...previous, ...Object.fromEntries(widths) }));
          }}
        />
      )}
    </th>
  );
}
function CellView<T extends RowData>({
  column,
  children,
  alignment,
}: {
  column: Column<typeof listFeatures, T> | Column<typeof selectableListFeatures, T> | Column<typeof treeFeatures, T>;
  children: ReactNode;
  alignment: TableAlignment;
}) {
  return (
    <td
      data-fixed={column.getIsPinned() || undefined}
      data-fixed-edge={
        column.getIsPinned() === 'start'
          ? column.getAfter('start') === 0 || undefined
          : column.getIsPinned() === 'end'
            ? column.getStart('end') === 0 || undefined
            : undefined
      }
      style={{ ...pinnedStyle(column), textAlign: alignment }}
    >
      <div className="pattern-cell-content">{children}</div>
    </td>
  );
}
function Pagination<T extends RowData>({
  table,
  labels,
  caption,
  initialPageSize,
}: {
  table: ListNativeTable<T>;
  labels: TableLabels;
  caption: string;
  initialPageSize: number;
}) {
  const { t } = useTranslation();
  const pagination = table.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const current = pagination.pageIndex + 1;
  const windowSize = pageCount > 7 ? 5 : 7;
  const start =
    pageCount > 7 ? (current >= pageCount - 2 ? Math.max(pageCount - windowSize + 1, 1) : Math.max(current - 2, 1)) : 1;
  const pages = Array.from({ length: Math.min(windowSize, pageCount) }, (_, index) => start + index);
  const firstLabel = labels.firstPage ?? t('common:table.first');
  const lastLabel = labels.lastPage ?? t('common:table.last');
  const previousJumpLabel = labels.previousPages ?? t('common:table.previousPages');
  const nextJumpLabel = labels.nextPages ?? t('common:table.nextPages');
  const control = (label: string, content: ReactNode, disabled: boolean, onClick: () => void) => (
    <Button
      variant="ghost"
      type="button"
      className="pattern-page-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </Button>
  );
  return (
    <nav
      className="pattern-pagination flex min-h-[36px] flex-wrap items-center gap-y-2 px-3 py-1 text-[12px] leading-[1.5714285714]"
      aria-label={caption}
    >
      <Select
        className="pattern-page-size me-auto h-[28px] w-auto min-w-24 px-2 text-[12px]"
        label={labels.pageSize}
        value={String(pagination.pageSize)}
        onValueChange={value => table.setPageSize(Number(value))}
        options={[...new Set([10, 20, 30, 50, 100, 200, initialPageSize, pagination.pageSize])]
          .sort((a, b) => a - b)
          .map(size => ({
            value: String(size),
            label: labels.pageSizeOption?.(size) ?? t('common:table.pageSizeOption', { size }),
          }))}
      />
      <span className="sr-only" aria-live="polite">
        {labels.page(current, pageCount)}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-y-2">
        {control(
          firstLabel,
          <span aria-hidden="true" className="inline-flex items-center">
            <span className="h-[12px] border-s border-current" />
            <ChevronLeft className="size-[12px]" />
          </span>,
          !table.getCanPreviousPage(),
          () => table.setPageIndex(0),
        )}
        {control(
          previousJumpLabel,
          <ChevronsLeft aria-hidden="true" className="size-[12px]" />,
          !table.getCanPreviousPage(),
          () => table.setPageIndex(Math.max(0, pagination.pageIndex - windowSize)),
        )}
        {control(
          labels.previousPage,
          <ChevronLeft aria-hidden="true" className="size-[12px]" />,
          !table.getCanPreviousPage(),
          () => table.previousPage(),
        )}
        {pages.map(page => (
          <Button
            key={page}
            variant="ghost"
            type="button"
            className="pattern-page-button"
            aria-label={labels.pageNumber?.(page) ?? t('common:table.pageNumber', { page })}
            aria-current={page === current ? 'page' : undefined}
            onClick={() => table.setPageIndex(page - 1)}
          >
            {page}
          </Button>
        ))}
        {control(
          labels.nextPage,
          <ChevronRight aria-hidden="true" className="size-[12px]" />,
          !table.getCanNextPage(),
          () => table.nextPage(),
        )}
        {control(
          nextJumpLabel,
          <ChevronsRight aria-hidden="true" className="size-[12px]" />,
          !table.getCanNextPage(),
          () => table.setPageIndex(Math.min(pageCount - 1, pagination.pageIndex + windowSize)),
        )}
        {control(
          lastLabel,
          <span aria-hidden="true" className="inline-flex items-center">
            <ChevronRight className="size-[12px]" />
            <span className="h-[12px] border-s border-current" />
          </span>,
          !table.getCanNextPage(),
          () => table.setPageIndex(pageCount - 1),
        )}
      </div>
    </nav>
  );
}
/** H/R preserve the concrete native row/header types at the render-slot boundary. */
function ListLayout<T extends RowData, H extends { id: string }, R extends { id: string; original: T }>({
  table,
  props,
  headerGroups,
  rows,
  renderHeader,
  renderCells,
  selectionHeader,
  selectionCell,
  selectionSummary,
  isRowSelected,
  footer,
}: {
  table: PresentationTable<T>;
  props: BaseTableProps<T> & ListSlices;
  headerGroups: readonly { id: string; headers: readonly H[] }[];
  rows: readonly R[];
  renderHeader: (header: H) => ReactNode;
  renderCells: (row: R) => ReactNode;
  selectionHeader?: ReactNode;
  selectionCell?: (row: R) => ReactNode;
  selectionSummary?: ReactNode;
  isRowSelected?: (row: R) => boolean;
  footer?: ReactNode;
}) {
  const [maximized, setMaximized] = useState(false);
  const section = useRef<HTMLElement>(null);
  if (maximized && !props.toolbar?.allowMaximize) setMaximized(false);
  useEffect(() => {
    if (!maximized) return;
    const closeMaximized = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (section.current?.closest('[hidden], [inert], [aria-hidden="true"]')) return;
      if (
        event.target instanceof Node &&
        event.target !== document.body &&
        event.target !== document.documentElement &&
        !section.current?.contains(event.target)
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')
      )
        return;
      event.preventDefault();
      setMaximized(false);
    };
    window.addEventListener('keydown', closeMaximized);
    return () => window.removeEventListener('keydown', closeMaximized);
  }, [maximized]);
  return (
    <section
      ref={section}
      className={cn(
        nativeTableClassName,
        maximized && 'pattern-table-maximized fixed inset-0 z-40 flex max-w-none flex-col rounded-none',
      )}
      aria-label={props.caption}
      data-maximized={maximized || undefined}
    >
      <TableToolbar
        table={table}
        props={props}
        selectionSummary={selectionSummary}
        maximized={maximized}
        onMaximizeChange={setMaximized}
      />
      <div
        className={cn(
          'native-table-scroll max-w-full overflow-x-auto overscroll-x-contain',
          maximized && 'min-h-0 flex-1 overflow-y-auto',
        )}
      >
        <table
          style={{
            width: selectionHeader
              ? `calc(${table.getTotalSize()}px + var(--control-height) + 1rem)`
              : table.getTotalSize(),
            tableLayout: 'fixed',
          }}
        >
          <caption className="sr-only">{props.caption}</caption>
          <thead>
            {headerGroups.map(group => (
              <tr key={group.id}>
                {selectionHeader && (
                  <th
                    scope="col"
                    className="pattern-selection-cell"
                    style={{ width: 'calc(var(--control-height) + 1rem)' }}
                  >
                    {selectionHeader}
                  </th>
                )}
                {group.headers.map(header => (
                  <Fragment key={header.id}>{renderHeader(header)}</Fragment>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {(props.readState !== 'ready' || rows.length === 0) && (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length + (selectionHeader ? 1 : 0)}
                  className="pattern-table-state"
                >
                  <ReadMessage props={props} hasRows={false} />
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr
                key={row.id}
                data-row-id={row.id}
                aria-selected={isRowSelected?.(row)}
                data-state={isRowSelected?.(row) ? 'selected' : undefined}
                {...rowActivation(row.original, props.onRowActivate)}
              >
                {selectionCell && <td className="pattern-selection-cell">{selectionCell(row)}</td>}
                {renderCells(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.readState === 'ready' && footer}
    </section>
  );
}
export function ListView<T extends RowData>({
  table,
  props,
}: {
  table: ReactTable<typeof listFeatures, T>;
  props: BaseTableProps<T> & ListSlices;
}) {
  const [initialPageSize] = useState(() => table.state.pagination.pageSize);
  return (
    <ListLayout
      table={table}
      props={props}
      footer={
        <Pagination table={table} labels={props.labels} caption={props.caption} initialPageSize={initialPageSize} />
      }
      headerGroups={table.getHeaderGroups()}
      rows={table.getRowModel().rows}
      renderHeader={header => (
        <HeaderView<T>
          header={header}
          labels={props.labels}
          disabled={props.readState !== 'ready'}
          alignment={columnAlignment(props, header.column.id)}
        >
          <table.FlexRender header={header} />
        </HeaderView>
      )}
      renderCells={row =>
        row.getVisibleCells().map(cell => (
          <CellView<T> key={cell.id} column={cell.column} alignment={columnAlignment(props, cell.column.id)}>
            <table.FlexRender cell={cell} />
          </CellView>
        ))
      }
    />
  );
}
export function SelectableView<T extends RowData>({
  table,
  props,
  selectionHeader,
  selectionCell,
  selectionSummary,
}: {
  table: ReactTable<typeof selectableListFeatures, T>;
  props: BaseTableProps<T> & ListSlices;
  selectionHeader?: ReactNode;
  selectionCell?: (row: Row<typeof selectableListFeatures, T>) => ReactNode;
  selectionSummary?: ReactNode;
}) {
  const [initialPageSize] = useState(() => table.state.pagination.pageSize);
  return (
    <ListLayout
      table={table}
      props={props}
      footer={
        <Pagination table={table} labels={props.labels} caption={props.caption} initialPageSize={initialPageSize} />
      }
      headerGroups={table.getHeaderGroups()}
      rows={table.getRowModel().rows}
      selectionHeader={selectionHeader}
      selectionCell={selectionCell}
      selectionSummary={selectionSummary}
      isRowSelected={selectionCell ? row => table.state.rowSelection[row.id] === true : undefined}
      renderHeader={header => (
        <HeaderView<T>
          header={header}
          labels={props.labels}
          disabled={props.readState !== 'ready'}
          alignment={columnAlignment(props, header.column.id)}
        >
          <table.FlexRender header={header} />
        </HeaderView>
      )}
      renderCells={row =>
        row.getVisibleCells().map(cell => (
          <CellView<T> key={cell.id} column={cell.column} alignment={columnAlignment(props, cell.column.id)}>
            <table.FlexRender cell={cell} />
          </CellView>
        ))
      }
    />
  );
}

export function TreeView<T extends RowData>({
  table,
  props,
}: {
  table: ReactTable<typeof treeFeatures, T>;
  props: TreeListTableProps<T>;
}) {
  const { t } = useTranslation();
  // Tree rows read as an outline, so they start-align unless the caller overrides it.
  const alignProps = { align: props.align ?? 'start', columnAlign: props.columnAlign };
  return (
    <ListLayout
      table={table}
      props={props}
      headerGroups={table.getHeaderGroups()}
      rows={table.getRowModel().rows}
      renderHeader={header => (
        <HeaderView<T>
          header={header}
          labels={props.labels}
          disabled={props.readState !== 'ready'}
          alignment={columnAlignment(alignProps, header.column.id)}
        >
          <table.FlexRender header={header} />
        </HeaderView>
      )}
      renderCells={row =>
        row.getVisibleCells().map(cell => (
          <CellView<T> key={cell.id} column={cell.column} alignment={columnAlignment(alignProps, cell.column.id)}>
            {cell.column.id === props.treeColumnId ? (
              <div
                className={cn(
                  'pattern-tree-cell flex min-w-0 items-center',
                  columnAlignment(alignProps, cell.column.id) === 'center'
                    ? 'justify-center'
                    : columnAlignment(alignProps, cell.column.id) === 'end'
                      ? 'justify-end'
                      : 'justify-start',
                )}
                style={{
                  paddingInlineStart:
                    columnAlignment(alignProps, cell.column.id) === 'end'
                      ? 0
                      : `calc(${row.depth} * var(--tree-indent))`,
                  paddingInlineEnd:
                    columnAlignment(alignProps, cell.column.id) === 'end'
                      ? `calc(${row.depth} * var(--tree-indent))`
                      : 0,
                }}
              >
                <span className="inline-flex w-[var(--control-height-sm)] shrink-0 items-center">
                  {row.getCanExpand() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="pattern-tree-toggle size-[var(--control-height-sm)] rounded-sm border-0 bg-transparent p-0 text-muted-foreground shadow-none! hover:bg-muted hover:text-foreground [&_svg]:size-[var(--control-icon-size)]"
                      data-state={row.getIsExpanded() ? 'open' : 'closed'}
                      aria-expanded={row.getIsExpanded()}
                      aria-label={t(row.getIsExpanded() ? 'common:table.collapseRow' : 'common:table.expandRow', {
                        name: props.getRowLabel(row.original),
                      })}
                      onClick={row.getToggleExpandedHandler()}
                    >
                      <ChevronDown aria-hidden="true" className={row.getIsExpanded() ? '' : '-rotate-90'} />
                    </Button>
                  )}
                </span>
                <div className="min-w-0">
                  <table.FlexRender cell={cell} />
                </div>
              </div>
            ) : (
              <table.FlexRender cell={cell} />
            )}
          </CellView>
        ))
      }
    />
  );
}
