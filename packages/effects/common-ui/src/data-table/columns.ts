import { createColumnHelper, type ColumnDef, type ColumnHelper, type RowData } from '@tanstack/react-table';
import { readFeatures, listFeatures, selectableListFeatures, treeFeatures } from './profiles';
export type ReadColumnDef<T extends RowData, TValue> = ColumnDef<typeof readFeatures, T, TValue>;
export type ListColumnDef<T extends RowData, TValue> = ColumnDef<typeof listFeatures, T, TValue>;
export type SelectableColumnDef<T extends RowData, TValue> = ColumnDef<typeof selectableListFeatures, T, TValue>;
export type TreeColumnDef<T extends RowData, TValue> = ColumnDef<typeof treeFeatures, T, TValue>;
export function createReadColumnHelper<T extends RowData>(): ColumnHelper<typeof readFeatures, T> {
  return createColumnHelper<typeof readFeatures, T>();
}
export function createListColumnHelper<T extends RowData>(): ColumnHelper<typeof listFeatures, T> {
  return createColumnHelper<typeof listFeatures, T>();
}
export function createSelectableColumnHelper<T extends RowData>(): ColumnHelper<typeof selectableListFeatures, T> {
  return createColumnHelper<typeof selectableListFeatures, T>();
}
export function createTreeColumnHelper<T extends RowData>(): ColumnHelper<typeof treeFeatures, T> {
  return createColumnHelper<typeof treeFeatures, T>();
}
