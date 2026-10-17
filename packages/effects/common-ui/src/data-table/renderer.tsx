import { nativeTableClassName } from './table-class-names';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Label } from '@niubu/shadcn-ui/label';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { rowActivation } from './row-activation';
import { Fragment, memo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { Column, Header, ReactTable, Row, RowData } from '@tanstack/react-table';
import type { listFeatures, selectableListFeatures } from './profiles';
import type { BaseTableProps, ListSlices, TableLabels } from './types';
import { clampColumnWidth } from './preferences';

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
  if (props.readState === 'pending')
    return (
      <div className="px-[18px] py-[32px]" role="status" aria-busy="true">
        {labels.pending}
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
    <div className="px-[18px] py-[32px]" role="status">
      {message}
      {props.emptyAction}
    </div>
  );
}
export const SelectionCheckbox = memo(function SelectionCheckbox({
  selected,
  indeterminate = false,
  label,
  onChange,
}: {
  selected: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={indeterminate ? 'indeterminate' : selected}
      onCheckedChange={checked => onChange(checked === true)}
    />
  );
});
function pinnedStyle<T extends RowData>(
  column: Column<typeof listFeatures, T> | Column<typeof selectableListFeatures, T>,
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
function ColumnWidthInput({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <NumberInput
      className="w-20 min-w-0 justify-self-end"
      valueMode="string"
      value={draft}
      onValueChange={setDraft}
      aria-label={label}
      min={80}
      max={640}
      onBlur={() => {
        const next = Number(draft);
        const width = Number.isFinite(next) ? clampColumnWidth(next) : value;
        setDraft(String(width));
        onCommit(width);
      }}
    />
  );
}
function ColumnSettings<T extends RowData>({
  table,
  labels,
  onResetColumns,
}: {
  table: ReactTable<typeof listFeatures, T> | ReactTable<typeof selectableListFeatures, T>;
  labels: TableLabels;
  onResetColumns?: () => void;
}) {
  const columns = table.getAllLeafColumns();
  return (
    <details className="pattern-table-settings group/table-settings relative ms-auto">
      <Button asChild variant="outline" size="sm">
        <summary className="list-none [&::-webkit-details-marker]:hidden">
          {labels.settings}
          <ChevronDown
            className="pattern-table-settings-chevron group-open/table-settings:rotate-180"
            aria-hidden="true"
          />
        </summary>
      </Button>
      <div className="pattern-column-settings absolute end-0 top-[calc(100%+8px)] z-20 grid max-h-[60dvh] w-[min(360px,calc(100vw-44px))] gap-[var(--workspace-heading-gap)] overflow-y-auto rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)] shadow-lg">
        {columns.map(column => {
          const name = labels.columnName(column.id);
          const visible = table.state.columnVisibility[column.id] !== false;
          return (
            <fieldset
              className="grid min-w-0 gap-[var(--workspace-heading-gap)] rounded-[var(--radius)] border border-border p-[var(--workspace-heading-gap)]"
              key={column.id}
            >
              <legend className="px-1 text-[length:var(--workspace-caption-font-size)] font-semibold">{name}</legend>
              <Label className="pattern-column-setting-toggle flex items-center gap-2">
                <Checkbox
                  checked={visible}
                  aria-label={labels.showColumn(name)}
                  disabled={!column.getCanHide() || (visible && table.getVisibleLeafColumns().length === 1)}
                  onCheckedChange={checked => column.toggleVisibility(checked === true)}
                />
                {labels.showColumn(name)}
              </Label>
              <Label className="pattern-column-setting-control grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-center gap-2">
                {labels.columnWidth(name)}
                <ColumnWidthInput
                  key={`${column.id}:${column.getSize()}`}
                  value={column.getSize()}
                  label={labels.columnWidth(name)}
                  onCommit={value => table.setColumnSizing(old => ({ ...old, [column.id]: value }))}
                />
              </Label>
              <Label className="pattern-column-setting-control grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-center gap-2">
                {labels.pinColumn(name)}
                <Select
                  className="w-full min-w-0"
                  label={labels.pinColumn(name)}
                  value={column.getIsPinned() || 'none'}
                  onValueChange={value => column.pin(value === 'start' ? 'start' : value === 'end' ? 'end' : false)}
                  options={[
                    { value: 'none', label: labels.unpin },
                    { value: 'start', label: labels.pinStart },
                    { value: 'end', label: labels.pinEnd },
                  ]}
                />
              </Label>
            </fieldset>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          type="button"
          onClick={() => {
            if (onResetColumns) {
              onResetColumns();
              return;
            }
            table.resetColumnVisibility();
            table.resetColumnSizing();
            table.resetColumnPinning();
          }}
        >
          {labels.resetColumns}
        </Button>
      </div>
    </details>
  );
}
type ListNativeTable<T extends RowData> =
  ReactTable<typeof listFeatures, T> | ReactTable<typeof selectableListFeatures, T>;
type ListNativeHeader<T extends RowData> = Header<typeof listFeatures, T> | Header<typeof selectableListFeatures, T>;

/** Only native header layout/actions are shared; the concrete owner supplies FlexRender. */
function HeaderView<T extends RowData>({
  header,
  labels,
  children,
}: {
  header: ListNativeHeader<T>;
  labels: TableLabels;
  children: ReactNode;
}) {
  const column = header.column;
  const sorted = column.getIsSorted();
  const name = labels.columnName(column.id);
  const width = header.getSize();
  return (
    <th
      scope={header.colSpan > 1 ? 'colgroup' : 'col'}
      colSpan={header.colSpan}
      style={{ ...pinnedStyle(column), width, minWidth: width, maxWidth: width }}
      aria-sort={
        column.getCanSort() ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined
      }
    >
      {!header.isPlaceholder &&
        (column.getCanSort() ? (
          <Button
            className="h-auto w-full min-w-0 justify-start gap-1 p-0 pe-6 text-start text-[12px] text-inherit [font-weight:inherit] [&_svg]:size-[12px]"
            variant="ghost"
            type="button"
            aria-label={labels.sortColumn(name)}
            title={name}
            onClick={column.getToggleSortingHandler()}
          >
            <span className="min-w-0 truncate">{children}</span>
            {sorted === 'asc' ? (
              <ArrowUp aria-hidden="true" />
            ) : sorted === 'desc' ? (
              <ArrowDown aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="inline-flex text-muted-foreground [&_svg]:size-[12px]">
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
}: {
  column: Column<typeof listFeatures, T> | Column<typeof selectableListFeatures, T>;
  children: ReactNode;
}) {
  return (
    <td style={pinnedStyle(column)}>
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
      <span className="me-3">{labels.total(table.getRowCount())}</span>
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
}: {
  table: ListNativeTable<T>;
  props: BaseTableProps<T> & ListSlices;
  headerGroups: readonly { id: string; headers: readonly H[] }[];
  rows: readonly R[];
  renderHeader: (header: H) => ReactNode;
  renderCells: (row: R) => ReactNode;
  selectionHeader?: ReactNode;
  selectionCell?: (row: R) => ReactNode;
  selectionSummary?: ReactNode;
  isRowSelected?: (row: R) => boolean;
}) {
  const [initialPageSize] = useState(() => table.state.pagination.pageSize);
  return (
    <section className={nativeTableClassName} aria-label={props.caption}>
      <div className="pattern-table-toolbar flex flex-wrap items-center justify-between gap-[var(--workspace-heading-gap)] px-[var(--workspace-card-padding)] py-[var(--workspace-heading-gap)] text-[length:var(--workspace-caption-font-size)]">
        <div className="pattern-table-summary flex min-w-0 flex-auto flex-wrap items-center gap-x-[var(--workspace-section-gap)] gap-y-[var(--workspace-heading-gap)] [&>p]:m-0">
          {selectionSummary}
        </div>
        <ColumnSettings table={table} labels={props.labels} onResetColumns={props.onResetColumns} />
      </div>
      <ReadMessage props={props} hasRows={rows.length > 0} />
      {props.readState === 'ready' && rows.length > 0 && (
        <div className="native-table-scroll max-w-full overflow-x-auto overscroll-x-contain">
          <table style={{ width: table.getTotalSize() + (selectionHeader ? 44 : 0), tableLayout: 'fixed' }}>
            <caption className="sr-only">{props.caption}</caption>
            <thead>
              {headerGroups.map(group => (
                <tr key={group.id}>
                  {selectionHeader && (
                    <th scope="col" className="pattern-selection-cell" style={{ width: 44 }}>
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
              {rows.map(row => (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  aria-selected={isRowSelected?.(row)}
                  {...rowActivation(row.original, props.onRowActivate)}
                >
                  {selectionCell && <td className="pattern-selection-cell">{selectionCell(row)}</td>}
                  {renderCells(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {props.readState === 'ready' && (
        <Pagination table={table} labels={props.labels} caption={props.caption} initialPageSize={initialPageSize} />
      )}
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
  return (
    <ListLayout
      table={table}
      props={props}
      headerGroups={table.getHeaderGroups()}
      rows={table.getRowModel().rows}
      renderHeader={header => (
        <HeaderView<T> header={header} labels={props.labels}>
          <table.FlexRender header={header} />
        </HeaderView>
      )}
      renderCells={row =>
        row.getVisibleCells().map(cell => (
          <CellView<T> key={cell.id} column={cell.column}>
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
  return (
    <ListLayout
      table={table}
      props={props}
      headerGroups={table.getHeaderGroups()}
      rows={table.getRowModel().rows}
      selectionHeader={selectionHeader}
      selectionCell={selectionCell}
      selectionSummary={selectionSummary}
      isRowSelected={selectionCell ? row => table.state.rowSelection[row.id] === true : undefined}
      renderHeader={header => (
        <HeaderView<T> header={header} labels={props.labels}>
          <table.FlexRender header={header} />
        </HeaderView>
      )}
      renderCells={row =>
        row.getVisibleCells().map(cell => (
          <CellView<T> key={cell.id} column={cell.column}>
            <table.FlexRender cell={cell} />
          </CellView>
        ))
      }
    />
  );
}
