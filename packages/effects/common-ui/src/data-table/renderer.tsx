import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Label } from '@niubu/shadcn-ui/label';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
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
      className="size-[24px]"
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
    background: pin ? 'var(--card, Canvas)' : undefined,
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
      className="w-[65px]"
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
    <details className="pattern-table-settings relative [&>summary]:min-h-[32px] [&>summary]:cursor-pointer">
      <summary>{labels.settings}</summary>
      <div className="pattern-column-settings absolute end-0 top-[calc(100%+8px)] z-10 max-h-[60dvh] w-[min(360px,calc(100vw-44px))] overflow-y-auto rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)]">
        {columns.map(column => {
          const name = labels.columnName(column.id);
          const visible = table.state.columnVisibility[column.id] !== false;
          return (
            <fieldset className="flex flex-wrap gap-[10px] border border-border p-[9px]" key={column.id}>
              <legend>{name}</legend>
              <Label className="flex items-center gap-[5px]">
                <Checkbox
                  className="size-[24px]"
                  checked={visible}
                  aria-label={labels.showColumn(name)}
                  disabled={!column.getCanHide() || (visible && table.getVisibleLeafColumns().length === 1)}
                  onCheckedChange={checked => column.toggleVisibility(checked === true)}
                />
                {labels.showColumn(name)}
              </Label>
              <Label className="flex items-center gap-[5px]">
                {labels.columnWidth(name)}
                <ColumnWidthInput
                  key={`${column.id}:${column.getSize()}`}
                  value={column.getSize()}
                  label={labels.columnWidth(name)}
                  onCommit={value => table.setColumnSizing(old => ({ ...old, [column.id]: value }))}
                />
              </Label>
              <Label className="flex items-center gap-[5px]">
                {labels.pinColumn(name)}
                <Select
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
            className="h-auto justify-start whitespace-normal p-0 text-inherit"
            variant="ghost"
            type="button"
            aria-label={labels.sortColumn(name)}
            onClick={column.getToggleSortingHandler()}
          >
            {children}
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
}: {
  table: ListNativeTable<T>;
  labels: TableLabels;
  caption: string;
}) {
  const pagination = table.state.pagination;
  return (
    <nav
      className="pattern-pagination flex flex-wrap items-center justify-between gap-[var(--workspace-heading-gap)] px-[var(--workspace-card-padding)] py-[var(--workspace-heading-gap)] text-[length:var(--workspace-body-font-size)]"
      aria-label={caption}
    >
      <Label className="flex items-center gap-[5px]">
        {labels.pageSize}
        <Select
          label={labels.pageSize}
          value={String(pagination.pageSize)}
          onValueChange={value => table.setPageSize(Number(value))}
          options={[...new Set([25, 50, 100, pagination.pageSize])]
            .sort((a, b) => a - b)
            .map(size => ({ value: String(size), label: String(size) }))}
        />
      </Label>
      <span aria-live="polite">{labels.page(pagination.pageIndex + 1, Math.max(1, table.getPageCount()))}</span>
      <Button
        variant="outline"
        type="button"
        aria-label={labels.previousPage}
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        {labels.previousPage}
      </Button>
      <Button
        variant="outline"
        type="button"
        aria-label={labels.nextPage}
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        {labels.nextPage}
      </Button>
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
}) {
  return (
    <section
      className="pattern-data-table native-data-table [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:text-start [&_th]:relative [&_th]:box-border [&_th]:h-[var(--row-height)] [&_th]:border-b [&_th]:border-border [&_th]:bg-secondary [&_th]:px-[var(--workspace-card-padding)] [&_th]:py-0 [&_th]:text-start [&_th]:text-[length:var(--workspace-caption-font-size)] [&_td]:box-border [&_td]:border-b [&_td]:border-border [&_td]:px-[var(--workspace-card-padding)] [&_td]:py-[var(--workspace-heading-gap)] [&_td]:text-[length:var(--workspace-body-font-size)] [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere] [&_tr[tabindex]]:cursor-pointer [&_tr:focus-visible]:outline-2 [&_tr:focus-visible]:outline-primary [&_tr:focus-visible]:-outline-offset-2 min-w-0 max-w-full rounded-[var(--radius)] border border-border bg-card"
      aria-label={props.caption}
    >
      <div className="pattern-table-toolbar flex flex-wrap items-center justify-between gap-[var(--workspace-heading-gap)] px-[var(--workspace-card-padding)] py-[var(--workspace-heading-gap)] text-[length:var(--workspace-body-font-size)]">
        {props.resultCount !== null && <p>{props.labels.total(props.resultCount)}</p>}
        {selectionSummary}
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
                    <th scope="col" style={{ width: 44 }}>
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
                <tr key={row.id} data-row-id={row.id} {...rowActivation(row.original, props.onRowActivate)}>
                  {selectionCell && <td>{selectionCell(row)}</td>}
                  {renderCells(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {props.readState === 'ready' && <Pagination table={table} labels={props.labels} caption={props.caption} />}
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
