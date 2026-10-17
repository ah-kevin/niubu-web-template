import { useMemo } from 'react';
import type { RowData } from '@tanstack/react-table';
import { treeFeatures } from './profiles';
import type { TreeListTableProps } from './types';
import { validateColumnIds, validateTreeReadModel, validateTreeRows } from './identity';
import { treeOwnership, validateTreeOwnership } from './owners';
import { listColumnDefaults } from './column-defaults';
import { useDataTable } from './useDataTable';
import { TreeView } from './renderer';

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
  const columnIds = useMemo(() => validateColumnIds(props.columns, true), [props.columns]);
  if (!columnIds.includes(props.treeColumnId)) throw Error('Tree column must name an existing leaf column');
  validateTreeOwnership(props, columnIds, props.treeColumnId);
  const columns = useMemo(
    () => protectTreeColumn(props.columns, props.treeColumnId),
    [props.columns, props.treeColumnId],
  );
  // Native core memoizes by data. A structural accessor change must invalidate it too.
  const structure = useMemo(
    () => ({ rows: props.model.rows.slice(), getSubRows: props.getSubRows }),
    [props.model.rows, props.getSubRows],
  );
  const table = useDataTable({
    features: treeFeatures,
    columns,
    data: structure.rows,
    getRowId: props.getRowId,
    getSubRows: structure.getSubRows,
    defaultColumn: listColumnDefaults,
    autoResetExpanded: false,
    columnResizeMode: 'onChange',
    enableMultiSort: false,
    enableSortingRemoval: false,
    ...treeOwnership(props, columnIds),
  });
  if (table.state.columnVisibility[props.treeColumnId] === false) throw Error('Tree column must remain visible');
  return <TreeView table={table} props={props} />;
}
