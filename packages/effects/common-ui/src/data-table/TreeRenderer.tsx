import { useEffect, useMemo, useState } from 'react';
import type { RowData } from '@tanstack/react-table';
import { treeFeatures } from './profiles';
import type { TreeListTableProps } from './types';
import { validateColumnIds, validateTreeReadModel, validateTreeRows } from './identity';
import { treeOwnership, validateTreeOwnership } from './owners';
import { listColumnDefaults } from './column-defaults';
import { useDataTable } from './useDataTable';
import { TreeView } from './renderer';
import { useTreeChildren } from './useTreeChildren';
import { searchTree, treeSelection } from './tree-model';

function protectTreeColumn<T extends RowData>(
  columns: TreeListTableProps<T>['columns'],
  treeColumnId: string,
): TreeListTableProps<T>['columns'] {
  return columns.map(column => {
    if ('columns' in column && column.columns?.length)
      return { ...column, columns: protectTreeColumn(column.columns, treeColumnId) };
    const id = column.id ?? ('accessorKey' in column ? String(column.accessorKey).replaceAll('.', '_') : undefined);
    return id === treeColumnId ? { ...column, enableHiding: false } : column;
  });
}

export function TreeRenderer<T extends RowData>(props: TreeListTableProps<T>) {
  const nodeCount = useMemo(
    () => validateTreeRows(props.model.rows, props.getRowId, props.getSubRows),
    [props.model.rows, props.getRowId, props.getSubRows],
  );
  validateTreeReadModel(props.model, props, nodeCount);
  return <OwnedTree key={props.tree?.lazy?.ownerKey ?? 'static'} {...props} />;
}

function OwnedTree<T extends RowData>(props: TreeListTableProps<T>) {
  const { loads, getSubRows, load } = useTreeChildren(props);
  const [internalSelection, setInternalSelection] = useState(() => {
    const state = props.tree?.selection?.state;
    return state?.kind === 'internal' ? (state.initial ?? {}) : {};
  });
  const selection = props.tree?.selection;
  const selected = selection?.state.kind === 'controlled' ? selection.state.value : internalSelection;
  const cascade = treeSelection(props.model.rows, getSubRows, props.getRowId, selected, selection?.isDisabled);
  const search = useMemo(
    () => searchTree(props.model.rows, getSubRows, props.getRowLabel, props.tree?.search?.query ?? ''),
    [props.model.rows, getSubRows, props.getRowLabel, props.tree?.search?.query],
  );
  const columnIds = useMemo(() => validateColumnIds(props.columns, true), [props.columns]);
  if (!columnIds.includes(props.treeColumnId)) throw Error('Tree column must name an existing leaf column');
  validateTreeOwnership(props, columnIds, props.treeColumnId);
  const columns = useMemo(
    () => protectTreeColumn(props.columns, props.treeColumnId),
    [props.columns, props.treeColumnId],
  );
  const structure = useMemo(
    () => ({
      rows: search.active ? props.model.rows.filter(row => search.visible.has(row)) : props.model.rows.slice(),
      getSubRows: (row: T, index: number) => {
        const children = getSubRows(row, index);
        return search.active ? children?.filter(child => search.visible.has(child)) : children;
      },
    }),
    [props.model.rows, getSubRows, search],
  );
  const table = useDataTable({
    features: treeFeatures,
    columns,
    data: structure.rows,
    getRowId: props.getRowId,
    getSubRows: structure.getSubRows,
    getRowCanExpand: row =>
      Boolean(
        structure.getSubRows(row.original, row.index)?.length ||
        (getSubRows(row.original, row.index) === undefined && props.tree?.lazy?.hasChildren(row.original)),
      ),
    defaultColumn: listColumnDefaults,
    autoResetExpanded: false,
    columnResizeMode: 'onChange',
    enableMultiSort: false,
    enableSortingRemoval: false,
    ...treeOwnership(props, columnIds),
  });
  useEffect(() => {
    if (props.readState !== 'ready') return;
    for (const row of table.getCoreRowModel().flatRows) {
      if (row.getIsExpanded() && !search.active) load(row.original);
    }
  }, [table, table.state.expanded, loads, load, props.readState, search.active, structure]);
  if (table.state.columnVisibility[props.treeColumnId] === false) throw Error('Tree column must remain visible');
  const count = validateTreeRows(props.model.rows, props.getRowId, getSubRows);
  const viewProps: TreeListTableProps<T> =
    props.readState === 'ready'
      ? {
          ...props,
          resultCount: search.active ? search.visible.size : count,
          sourceCount: props.tree?.lazy ? null : props.sourceCount,
        }
      : props;
  return (
    <TreeView
      table={table}
      props={viewProps}
      capabilities={{
        loads,
        load,
        search,
        cascade,
        changeSelection: (row, checked) => {
          const next = cascade.toggle(row, checked);
          if (selection?.state.kind === 'controlled') selection.state.onChange(next);
          else setInternalSelection(next);
        },
      }}
    />
  );
}
