import { useColumnFilters, hasFilterValue } from './advanced-state';
import type { ColumnFilterValue } from './advanced-types';
import { columnAlignment } from './alignment';
import { nativeTableClassName } from './table-class-names';
import { Button } from '@niubu/shadcn-ui/button';
import { rowActivation } from './row-activation';
import type { RowData } from '@tanstack/react-table';
import { useMemo, useId, type ReactElement } from 'react';
import { listFeatures, readFeatures, selectableListFeatures } from './profiles';
import { validateColumnIds, validateReadModel, validateRowIds } from './identity';
import { useDataTable } from './useDataTable';
import { listOwnership, validateListOwnership, listInstanceKey } from './owners';
import { ListView, SelectableView, ReadMessage, SelectionCheckbox } from './renderer';
import type { DataTableProps, ListTableProps, ReadTableProps, SelectableTableProps } from './types';
import { listColumnDefaults as defaults } from './column-defaults';
import { TreeRenderer } from './TreeRenderer';

/** Each discriminant mounts a renderer with a fixed, module-scoped native feature set. */
export function DataTable<T extends RowData>(props: DataTableProps<T>): ReactElement {
  if (props.profile === 'tree-list')
    return <TreeRenderer key={`${listInstanceKey(props)}:${props.expanded?.kind ?? 'internal'}`} {...props} />;
  validateRowIds(props.model.rows, props.getRowId);
  validateReadModel(props.model, props);
  if (props.profile !== 'read' && props.refresh && props.readState !== 'ready')
    throw Error('Refresh retains a ready model; pending reads require empty rows');
  if (props.profile === 'read') return <ReadRenderer {...props} />;
  if (props.profile === 'list') return <ListRenderer key={listInstanceKey(props)} {...props} />;
  return <SelectableRenderer key={`${listInstanceKey(props)}:${props.rowSelection.kind}`} {...props} />;
}
function ReadRenderer<T extends RowData>(props: ReadTableProps<T>) {
  useMemo(() => validateColumnIds(props.columns), [props.columns]);
  const table = useDataTable({
    features: readFeatures,
    columns: props.columns,
    data: props.model.rows,
    getRowId: props.getRowId,
  });
  const rows = table.getRowModel().rows;
  return (
    <section
      className={nativeTableClassName}
      aria-label={props.caption}
      data-sticky-header={props.layout?.stickyHeader || undefined}
      data-striped={props.layout?.striped || undefined}
      data-bordered={props.layout?.bordered || undefined}
      data-wrap={props.layout?.wrap === true || undefined}
    >
      <div
        className="native-table-scroll max-w-full overflow-auto overscroll-x-contain"
        style={{ maxHeight: props.layout?.maxHeight }}
      >
        <table className="w-full">
          <caption>{props.caption}</caption>
          <thead>
            {table.getHeaderGroups().map(group => (
              <tr key={group.id}>
                {group.headers.map(header => (
                  <th
                    style={{ textAlign: columnAlignment(props, header.column.id) }}
                    key={header.id}
                    colSpan={header.colSpan}
                    scope={header.colSpan > 1 ? 'colgroup' : 'col'}
                  >
                    {!header.isPlaceholder && <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {(props.readState !== 'ready' || rows.length === 0) && (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="pattern-table-state">
                  <ReadMessage props={props} hasRows={false} />
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.id} data-row-id={row.id} {...rowActivation(row.original, props.onRowActivate)}>
                {row.getAllCells().map(cell => (
                  <td
                    key={cell.id}
                    data-wrap={
                      (Array.isArray(props.layout?.wrap) && props.layout.wrap.includes(cell.column.id)) || undefined
                    }
                    style={{ textAlign: columnAlignment(props, cell.column.id) }}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ListRenderer<T extends RowData>(props: ListTableProps<T>) {
  const filters = useColumnFilters(props.model.rows, props.columnFilters);
  if (props.model.kind === 'server' && props.columnFilters?.mode === 'local')
    throw Error('Local column filters require the complete client model');
  const viewProps = {
    ...props,
    ...(props.readState === 'ready'
      ? {
          readState: 'ready' as const,
          resultCount: props.columnFilters?.mode === 'local' ? filters.rows.length : props.resultCount,
        }
      : { readState: props.readState, resultCount: null, sourceCount: null }),
    filterValues: filters.values,
    onFilterChange: (id: string, value: ColumnFilterValue) => {
      filters.update(previous => ({
        ...previous,
        [id]: props.columnFilters?.selection === 'multiple' || typeof value === 'string' ? value : (value[0] ?? ''),
      }));
      table.setPageIndex(0);
    },
  };

  const columnIds = useMemo(() => validateColumnIds(props.columns, true), [props.columns]);
  validateListOwnership(props, columnIds);
  const table = useDataTable({
    features: listFeatures,
    columns: props.columns,
    data: filters.rows,
    getRowId: props.getRowId,
    defaultColumn: defaults,
    autoResetPageIndex: false,
    manualSorting: props.model.kind === 'server',
    manualPagination: props.model.kind === 'server',
    ...(props.model.kind === 'server' ? { rowCount: props.model.rowCount } : {}),
    columnResizeMode: 'onChange',
    enableMultiSort: false,
    enableSortingRemoval: props.enableSortingRemoval ?? false,
    ...(props.enableSortingRemoval ? { sortDescFirst: false } : {}),
    ...listOwnership(props, columnIds),
  });
  return (
    <ListView
      table={table}
      props={{
        ...viewProps,
        reorderAllowed:
          props.model.kind === 'client' &&
          props.sourceCount === props.resultCount &&
          !table.state.sorting.length &&
          !Object.values(filters.values).some(hasFilterValue) &&
          table.getRowModel().rows.length === props.model.rows.length,
      }}
    />
  );
}
function SelectableRenderer<T extends RowData>(props: SelectableTableProps<T>) {
  const selectionName = useId();
  const filters = useColumnFilters(props.model.rows, props.columnFilters);
  if (props.model.kind === 'server' && props.columnFilters?.mode === 'local')
    throw Error('Local column filters require the complete client model');
  const viewProps = {
    ...props,
    ...(props.readState === 'ready'
      ? {
          readState: 'ready' as const,
          resultCount: props.columnFilters?.mode === 'local' ? filters.rows.length : props.resultCount,
        }
      : { readState: props.readState, resultCount: null, sourceCount: null }),
    filterValues: filters.values,
    onFilterChange: (id: string, value: ColumnFilterValue) => {
      filters.update(previous => ({
        ...previous,
        [id]: props.columnFilters?.selection === 'multiple' || typeof value === 'string' ? value : (value[0] ?? ''),
      }));
      table.setPageIndex(0);
    },
  };

  const columnIds = useMemo(() => validateColumnIds(props.columns, true), [props.columns]);
  validateListOwnership(props, columnIds);
  const owners = listOwnership(props, columnIds);
  const table = useDataTable({
    features: selectableListFeatures,
    columns: props.columns,
    data: filters.rows,
    getRowId: props.getRowId,
    defaultColumn: defaults,
    autoResetPageIndex: false,
    manualSorting: props.model.kind === 'server',
    manualPagination: props.model.kind === 'server',
    ...(props.model.kind === 'server' ? { rowCount: props.model.rowCount } : {}),
    columnResizeMode: 'onChange',
    enableMultiSort: false,
    enableSortingRemoval: props.enableSortingRemoval ?? false,
    ...(props.enableSortingRemoval ? { sortDescFirst: false } : {}),
    enableRowSelection: row => props.canSelectRow?.(row.original) !== false,
    enableMultiRowSelection: props.selectionMode !== 'single',
    enableSubRowSelection: false,
    enableRowRangeSelection: false,
    ...owners,
    initialState: {
      ...owners.initialState,
      ...(props.rowSelection.kind === 'internal' && props.rowSelection.initial !== undefined
        ? { rowSelection: props.rowSelection.initial }
        : {}),
    },
    state: {
      ...owners.state,
      ...(props.rowSelection.kind === 'controlled' ? { rowSelection: props.rowSelection.value } : {}),
    },
    ...(props.rowSelection.kind === 'controlled' ? { onRowSelectionChange: props.rowSelection.onChange } : {}),
  });
  const selected = table.state.rowSelection;
  return (
    <SelectableView
      table={table}
      props={{
        ...viewProps,
        onRowActivate:
          props.selectionMode === 'single'
            ? row => {
                if (props.canSelectRow?.(row) === false) return;
                table.setRowSelection({ [props.getRowId(row)]: true });
                props.onRowActivate?.(row);
              }
            : props.onRowActivate,
        reorderAllowed:
          props.model.kind === 'client' &&
          props.sourceCount === props.resultCount &&
          !table.state.sorting.length &&
          !Object.values(filters.values).some(hasFilterValue) &&
          table.getRowModel().rows.length === props.model.rows.length,
      }}
      selectionSummary={
        <div
          data-active={Object.keys(selected).length > 0 || undefined}
          className="pattern-selection-bar flex min-w-0 flex-wrap items-center gap-[var(--workspace-heading-gap)] p-0 text-[length:var(--workspace-caption-font-size)]"
        >
          <span className="font-medium text-foreground">
            {props.selectionLabels.selected(Object.keys(selected).length)}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {props.selectionMode !== 'single' && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={
                  props.readState !== 'ready' ||
                  !viewProps.resultCount ||
                  !!props.refresh ||
                  (props.model.kind === 'server' && !props.onSelectAllResults)
                }
                onClick={() => {
                  if (props.model.kind === 'server') props.onSelectAllResults?.();
                  else table.toggleAllRowsSelected(true);
                }}
              >
                {props.selectionLabels.selectAllResults(viewProps.resultCount ?? 0)}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={Object.keys(selected).length === 0}
              onClick={() => table.setRowSelection({})}
            >
              {props.selectionLabels.clearSelection}
            </Button>
          </div>
          {props.selectionMode !== 'single' && props.model.kind === 'server' && !props.onSelectAllResults && (
            <span className="basis-full text-muted-foreground">{props.selectionLabels.allResultsUnavailable}</span>
          )}
        </div>
      }
      selectionHeader={
        props.selectionMode === 'single' ? (
          <span className="sr-only">{props.selectionLabels.selectPage}</span>
        ) : (
          <SelectionCheckbox
            label={props.selectionLabels.selectPage}
            disabled={
              props.readState !== 'ready' ||
              !!props.refresh ||
              !table.getRowModel().rows.some(row => row.getCanSelect())
            }
            selected={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={selected => table.toggleAllPageRowsSelected(selected)}
          />
        )
      }
      selectionCell={row =>
        props.selectionMode === 'single' ? (
          <input
            type="radio"
            className="pattern-table-radio"
            name={selectionName}
            checked={selected[row.id] === true}
            aria-label={props.selectionLabels.selectRow(row.id)}
            disabled={props.readState !== 'ready' || !!props.refresh || !row.getCanSelect()}
            onChange={() => table.setRowSelection({ [row.id]: true })}
          />
        ) : (
          <SelectionCheckbox
            selected={selected[row.id] === true}
            disabled={props.readState !== 'ready' || !!props.refresh || !row.getCanSelect()}
            label={props.selectionLabels.selectRow(row.id)}
            onChange={selected => row.toggleSelected(selected)}
          />
        )
      }
    />
  );
}
