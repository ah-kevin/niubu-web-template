import type { ReactNode } from 'react';
import type {
  RowData,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
  TableOptions,
} from '@tanstack/react-table';
import type { listFeatures, readFeatures, selectableListFeatures } from './profiles';
export type SliceOwner<S> =
  | { kind: 'internal'; initial?: S; value?: never; onChange?: never }
  | { kind: 'controlled'; value: S; onChange: OnChangeFn<S>; initial?: never };
export type DataModel<T> =
  { kind: 'client'; rows: readonly T[] } | { kind: 'server'; rows: readonly T[]; rowCount: number };
export type TableReadMetadata =
  | { readState: 'ready'; sourceCount: number | null; resultCount: number }
  | { readState: 'pending' | 'error'; sourceCount: null; resultCount: null };
export interface TableLabels {
  pending: string;
  error: string;
  sourceEmpty: string;
  sourceUnknown: string;
  filteredEmpty: string;
  pageEmpty: string;
  previousPage: string;
  nextPage: string;
  pageSize: string;
  settings: string;
  resetColumns: string;
  pinStart: string;
  pinEnd: string;
  unpin: string;
  columnName: (id: string) => string;
  showColumn: (name: string) => string;
  columnWidth: (name: string) => string;
  resizeColumn: (name: string) => string;
  pinColumn: (name: string) => string;
  sortColumn: (name: string) => string;
  page: (oneBasedPage: number, pageCount: number) => string;
  total: (count: number) => string;
}
export type BaseTableProps<T> = TableReadMetadata & {
  getRowId: (row: T) => string;
  caption: string;
  labels: TableLabels;
  onRowActivate?: (row: T) => void;
  emptyAction?: ReactNode;
};
export type ReadTableProps<T extends RowData> = BaseTableProps<T> & {
  profile: 'read';
  model: Extract<DataModel<T>, { kind: 'client' }>;
  columns: TableOptions<typeof readFeatures, T>['columns'];
};
export interface ListSlices {
  sorting?: SliceOwner<SortingState>;
  pagination?: SliceOwner<PaginationState>;
  columnVisibility?: SliceOwner<ColumnVisibilityState>;
  columnPinning?: SliceOwner<ColumnPinningState>;
  columnSizing?: SliceOwner<ColumnSizingState>;
  /** External preference owners reset their validated defaults in their current scope. */
  onResetColumns?: () => void;
}
export type ListTableProps<T extends RowData> = BaseTableProps<T> &
  ListSlices & {
    profile: 'list';
    model: DataModel<T>;
    columns: TableOptions<typeof listFeatures, T>['columns'];
  };
export type SelectableTableProps<T extends RowData> = BaseTableProps<T> &
  ListSlices & {
    profile: 'selectable-list';
    model: DataModel<T>;
    columns: TableOptions<typeof selectableListFeatures, T>['columns'];
    rowSelection: SliceOwner<RowSelectionState>;
    onSelectAllResults?: () => void;
    selectionLabels: {
      selectPage: string;
      selectRow: (id: string) => string;
      selected: (count: number) => string;
      selectAllResults: (count: number) => string;
      clearSelection: string;
      allResultsUnavailable: string;
    };
  };
export type DataTableProps<T extends RowData> = ReadTableProps<T> | ListTableProps<T> | SelectableTableProps<T>;
export type {
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
  Updater,
} from '@tanstack/react-table';
