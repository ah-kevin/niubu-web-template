import { nativeTableClassName } from './table-class-names';
import { Button } from '@niubu/shadcn-ui/button';
import { rowActivation } from './row-activation';
import type { RowData } from '@tanstack/react-table';
import { useMemo, type ReactElement } from 'react';
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
    <section className={nativeTableClassName} aria-label={props.caption}>
      <ReadMessage props={props} hasRows={rows.length > 0} />
      {props.readState === 'ready' && rows.length > 0 && (
        <div className="native-table-scroll max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full">
            <caption>{props.caption}</caption>
            <thead>
              {table.getHeaderGroups().map(group => (
                <tr key={group.id}>
                  {group.headers.map(header => (
                    <th key={header.id} colSpan={header.colSpan} scope={header.colSpan > 1 ? 'colgroup' : 'col'}>
                      {!header.isPlaceholder && <table.FlexRender header={header} />}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} data-row-id={row.id} {...rowActivation(row.original, props.onRowActivate)}>
                  {row.getAllCells().map(cell => (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function ListRenderer<T extends RowData>(props: ListTableProps<T>) {
  const columnIds = useMemo(() => validateColumnIds(props.columns, true), [props.columns]);
  validateListOwnership(props, columnIds);
  const table = useDataTable({
    features: listFeatures,
    columns: props.columns,
    data: props.model.rows,
    getRowId: props.getRowId,
    defaultColumn: defaults,
    autoResetPageIndex: false,
    manualSorting: props.model.kind === 'server',
    manualPagination: props.model.kind === 'server',
    ...(props.model.kind === 'server' ? { rowCount: props.model.rowCount } : {}),
    columnResizeMode: 'onChange',
    enableMultiSort: false,
    enableSortingRemoval: false,
    ...listOwnership(props, columnIds),
  });
  return <ListView table={table} props={props} />;
}
function SelectableRenderer<T extends RowData>(props: SelectableTableProps<T>) {
  const columnIds = useMemo(() => validateColumnIds(props.columns, true), [props.columns]);
  validateListOwnership(props, columnIds);
  const owners = listOwnership(props, columnIds);
  const table = useDataTable({
    features: selectableListFeatures,
    columns: props.columns,
    data: props.model.rows,
    getRowId: props.getRowId,
    defaultColumn: defaults,
    autoResetPageIndex: false,
    manualSorting: props.model.kind === 'server',
    manualPagination: props.model.kind === 'server',
    ...(props.model.kind === 'server' ? { rowCount: props.model.rowCount } : {}),
    columnResizeMode: 'onChange',
    enableMultiSort: false,
    enableSortingRemoval: false,
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
      props={props}
      selectionSummary={
        <div className="pattern-selection-bar flex min-w-0 flex-wrap items-center gap-[var(--workspace-heading-gap)] p-0 text-[length:var(--workspace-caption-font-size)]">
          <span className="font-medium text-foreground">
            {props.selectionLabels.selected(Object.keys(selected).length)}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={
                props.readState !== 'ready' ||
                !props.resultCount ||
                (props.model.kind === 'server' && !props.onSelectAllResults)
              }
              onClick={() => {
                if (props.model.kind === 'server') props.onSelectAllResults?.();
                else table.toggleAllRowsSelected(true);
              }}
            >
              {props.selectionLabels.selectAllResults(props.resultCount ?? 0)}
            </Button>
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
          {props.model.kind === 'server' && !props.onSelectAllResults && (
            <span className="basis-full text-muted-foreground">{props.selectionLabels.allResultsUnavailable}</span>
          )}
        </div>
      }
      selectionHeader={
        <SelectionCheckbox
          label={props.selectionLabels.selectPage}
          selected={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onChange={selected => table.toggleAllPageRowsSelected(selected)}
        />
      }
      selectionCell={row => (
        <SelectionCheckbox
          selected={selected[row.id] === true}
          label={props.selectionLabels.selectRow(row.id)}
          onChange={selected => row.toggleSelected(selected)}
        />
      )}
    />
  );
}
