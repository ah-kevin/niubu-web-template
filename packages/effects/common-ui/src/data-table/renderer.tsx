import { rowActivation } from './row-activation';
import { Fragment, memo, type CSSProperties, type ReactElement, type ReactNode } from 'react';
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
      <div role="status" aria-busy="true">
        {labels.pending}
      </div>
    );
  if (props.readState === 'error')
    return (
      <div role="alert">
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
    <div role="status">
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
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={selected}
      aria-checked={indeterminate ? 'mixed' : selected}
      ref={input => {
        if (input) input.indeterminate = indeterminate;
      }}
      onChange={onChange}
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
    <details className="pattern-table-settings">
      <summary>{labels.settings}</summary>
      <div className="pattern-column-settings">
        {columns.map(column => {
          const name = labels.columnName(column.id);
          const visible = table.state.columnVisibility[column.id] !== false;
          return (
            <fieldset key={column.id}>
              <legend>{name}</legend>
              <label>
                <input
                  type="checkbox"
                  checked={visible}
                  aria-label={labels.showColumn(name)}
                  disabled={!column.getCanHide() || (visible && table.getVisibleLeafColumns().length === 1)}
                  onChange={column.getToggleVisibilityHandler()}
                />
                {labels.showColumn(name)}
              </label>
              <label>
                {labels.columnWidth(name)}
                <input
                  type="number"
                  key={`${column.id}:${column.getSize()}`}
                  aria-label={labels.columnWidth(name)}
                  min={80}
                  max={640}
                  defaultValue={column.getSize()}
                  onBlur={event => {
                    const n = Number(event.currentTarget.value);
                    const value = Number.isFinite(n) ? clampColumnWidth(n) : column.getSize();
                    event.currentTarget.value = String(value);
                    table.setColumnSizing(old => ({ ...old, [column.id]: value }));
                  }}
                />
              </label>
              <label>
                {labels.pinColumn(name)}
                <select
                  aria-label={labels.pinColumn(name)}
                  value={column.getIsPinned() || 'none'}
                  onChange={event =>
                    column.pin(
                      event.currentTarget.value === 'start'
                        ? 'start'
                        : event.currentTarget.value === 'end'
                          ? 'end'
                          : false,
                    )
                  }
                >
                  <option value="none">{labels.unpin}</option>
                  <option value="start">{labels.pinStart}</option>
                  <option value="end">{labels.pinEnd}</option>
                </select>
              </label>
            </fieldset>
          );
        })}
        <button
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
        </button>
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
          <button type="button" aria-label={labels.sortColumn(name)} onClick={column.getToggleSortingHandler()}>
            {children}
          </button>
        ) : (
          children
        ))}
      {column.getCanResize() && (
        <button
          type="button"
          className="pattern-column-resizer"
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
    <nav className="pattern-pagination" aria-label={caption}>
      <label>
        {labels.pageSize}
        <select
          aria-label={labels.pageSize}
          value={pagination.pageSize}
          onChange={event => table.setPageSize(Number(event.currentTarget.value))}
        >
          {[...new Set([25, 50, 100, pagination.pageSize])]
            .sort((a, b) => a - b)
            .map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
        </select>
      </label>
      <span aria-live="polite">{labels.page(pagination.pageIndex + 1, Math.max(1, table.getPageCount()))}</span>
      <button
        type="button"
        aria-label={labels.previousPage}
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        {labels.previousPage}
      </button>
      <button
        type="button"
        aria-label={labels.nextPage}
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        {labels.nextPage}
      </button>
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
    <section className="pattern-data-table native-data-table" aria-label={props.caption}>
      <div className="pattern-table-toolbar">
        {props.resultCount !== null && <p>{props.labels.total(props.resultCount)}</p>}
        {selectionSummary}
        <ColumnSettings table={table} labels={props.labels} onResetColumns={props.onResetColumns} />
      </div>
      <ReadMessage props={props} hasRows={rows.length > 0} />
      {props.readState === 'ready' && rows.length > 0 && (
        <div className="native-table-scroll">
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
