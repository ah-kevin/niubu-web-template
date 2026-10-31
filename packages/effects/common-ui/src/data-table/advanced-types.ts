import type { CSSProperties, ReactNode } from 'react';
import type { SliceOwner } from './types';

export interface TableLayoutOptions {
  stickyHeader?: boolean;
  maxHeight?: CSSProperties['maxHeight'];
  striped?: boolean;
  bordered?: boolean;
  wrap?: boolean | readonly string[];
}
export type ColumnFilterValues = Record<string, string>;
export interface ColumnFilterField {
  label: string;
  options?: readonly { value: string; label: string }[];
}
export type TableColumnFilters<T> = {
  fields: Readonly<Record<string, ColumnFilterField>>;
  clearLabel: string;
  activeLabel: string;
} & (
  | {
      mode: 'local';
      state?: SliceOwner<ColumnFilterValues>;
      matches: (row: T, columnId: string, value: string) => boolean;
    }
  | { mode: 'manual'; state: Extract<SliceOwner<ColumnFilterValues>, { kind: 'controlled' }> }
);
export interface TableDetails<T> {
  expanded?: SliceOwner<Record<string, boolean>>;
  canExpand?: (row: T) => boolean;
  label: (row: T, expanded: boolean) => string;
  render: (row: T) => ReactNode;
}
export interface TableEditing<T> {
  /** Changing identity/scope retires any pending save, even when row IDs are reused. */
  ownerKey?: string;
  rowId?: SliceOwner<string | null>;
  /** Return an independent draft; the original model remains owned by the caller. */
  createDraft: (row: T) => T;
  renderCell: (context: {
    columnId: string;
    row: T;
    draft: T;
    setDraft: (next: T) => void;
    error?: string;
    disabled: boolean;
  }) => ReactNode | null;
  validate: (draft: T) => Readonly<Record<string, string>>;
  onSave: (draft: T, context: { row: T; rowId: string; signal: AbortSignal }) => Promise<void>;
  onCancel?: (row: T) => void;
  canEdit?: (row: T) => boolean;
  labels: { edit: string; save: string; cancel: string; saving: string; failed: string; actions: string };
}
export interface CellSpan {
  rowSpan?: number;
  colSpan?: number;
}
export interface CellSpanContext<T> {
  row: T;
  rowIndex: number;
  columnId: string;
  columnIndex: number;
  /** Current visible page in displayed order, after filtering/sorting/hiding. */
  rows: readonly T[];
  columnIds: readonly string[];
}
export interface TableSummary<T> {
  label: string;
  /** Summaries receive only the displayed page. Label the scope accordingly. */
  renderCell: (columnId: string, rows: readonly T[]) => ReactNode;
  colSpan?: (columnId: string, columnIds: readonly string[]) => number;
}
export interface TableReorder<T> {
  onReorder: (rowIds: readonly string[], context: { rows: readonly T[]; signal: AbortSignal }) => Promise<void>;
  labels: { handle: (row: T) => string; disabled: string; pickedUp: string; saving: string; failed: string };
}
export interface AdvancedTableOptions<T> {
  layout?: TableLayoutOptions;
  columnFilters?: TableColumnFilters<T>;
  details?: TableDetails<T>;
  editing?: TableEditing<T>;
  cellSpan?: (context: CellSpanContext<T>) => CellSpan | undefined;
  summary?: TableSummary<T>;
  reorder?: TableReorder<T>;
  /** Keep the last successful ready model explicit; ordinary pending reads still require empty rows. */
  refresh?: 'pending' | 'error';
}
