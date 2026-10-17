import type { TableFeatures, TableOptions, RowData, ColumnDef } from '@tanstack/react-table';
import type { DataModel, TableReadMetadata } from './types';
const reservedIds = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
export const isSafeColumnId = (id: string): boolean => Boolean(id.trim()) && !reservedIds.has(id);
export function validateRowIds<T>(rows: readonly T[], getRowId: (row: T) => string): void {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = getRowId(row);
    if (typeof id !== 'string' || !id.trim()) throw Error('Row ID must not be empty');
    if (ids.has(id)) throw Error(`Row ID is duplicate: ${id}`);
    ids.add(id);
  }
}
export function validateColumnIds<F extends TableFeatures, T extends RowData>(
  columns: TableOptions<F, T>['columns'],
  checkWidths = false,
): string[] {
  const ids = new Set<string>();
  const leaves: string[] = [];
  function visit(defs: readonly ColumnDef<F, T>[]) {
    for (const column of defs) {
      // Match native constructColumn: accessor dots normalize, explicit IDs do not.
      const id =
        column.id ??
        ('accessorKey' in column && column.accessorKey !== undefined
          ? String(column.accessorKey).replaceAll('.', '_')
          : undefined);
      if (!id || !isSafeColumnId(id) || ids.has(id)) throw Error('Column ID must be explicit, safe and unique');
      ids.add(id);
      if (checkWidths) {
        const widths = [
          'size' in column ? column.size : undefined,
          'minSize' in column ? column.minSize : undefined,
          'maxSize' in column ? column.maxSize : undefined,
        ];
        if (
          widths.some(
            width =>
              width !== undefined &&
              (typeof width !== 'number' || !Number.isFinite(width) || width < 80 || width > 640),
          )
        )
          throw Error('Column width bounds must be between 80 and 640');
        if (
          'minSize' in column &&
          'maxSize' in column &&
          typeof column.minSize === 'number' &&
          typeof column.maxSize === 'number' &&
          column.minSize > column.maxSize
        )
          throw Error('Column width minimum exceeds maximum');
      }
      if ('columns' in column && column.columns?.length) visit(column.columns);
      else leaves.push(id);
    }
  }
  visit(columns);
  if (!leaves.length) throw Error('A table requires at least one column');
  return leaves;
}
export function validateReadModel<T>(model: DataModel<T>, metadata: TableReadMetadata): void {
  const count = (n: number | null, name: string) => {
    if (n !== null && (!Number.isSafeInteger(n) || n < 0)) throw Error(`${name} must be a non-negative safe integer`);
  };
  count(metadata.sourceCount, 'sourceCount');
  count(metadata.resultCount, 'resultCount');
  if (model.kind === 'server') count(model.rowCount, 'rowCount');
  if (metadata.readState !== 'ready') {
    if (model.rows.length || metadata.sourceCount !== null || metadata.resultCount !== null)
      throw Error('Non-ready reads require no rows and unknown counts');
    return;
  }
  if (metadata.resultCount === null) throw Error('Ready reads require resultCount');
  if (metadata.sourceCount !== null && metadata.resultCount > metadata.sourceCount)
    throw Error('resultCount exceeds sourceCount');
  if (model.kind === 'client' && model.rows.length !== metadata.resultCount)
    throw Error('Client rows must contain the complete current result');
  if (model.kind === 'server' && (model.rowCount !== metadata.resultCount || model.rows.length > model.rowCount))
    throw Error('Server rowCount must equal resultCount and cover the loaded page');
}

/** Validate the supplied hierarchy, never the expansion-dependent visible sequence. */
export function validateTreeRows<T>(
  rows: readonly T[],
  getRowId: (row: T) => string,
  getSubRows: (row: T, index: number) => readonly T[] | undefined,
): number {
  const ids = new Set<string>();
  const ancestors = new Set<T>();
  let count = 0;
  function visit(nodes: readonly T[]) {
    nodes.forEach((row, index) => {
      if (ancestors.has(row)) throw Error('Tree contains a cycle');
      const id = getRowId(row);
      if (typeof id !== 'string' || !id.trim()) throw Error('Row ID must not be empty');
      if (!isSafeColumnId(id)) throw Error('Tree row ID must be safe');
      if (ids.has(id)) throw Error(`Row ID is duplicate: ${id}`);
      ids.add(id);
      count++;
      ancestors.add(row);
      const children = getSubRows(row, index);
      if (children !== undefined) {
        if (!Array.isArray(children)) throw Error('Tree subrows must be a synchronous array');
        visit(children);
      }
      ancestors.delete(row);
    });
  }
  visit(rows);
  return count;
}

export function validateTreeReadModel<T>(model: DataModel<T>, metadata: TableReadMetadata, nodeCount: number): void {
  if (model.kind !== 'client') throw Error('Tree lists require a complete client hierarchy');
  for (const [name, value] of [
    ['sourceCount', metadata.sourceCount],
    ['resultCount', metadata.resultCount],
  ] as const) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0))
      throw Error(`${name} must be a non-negative safe integer`);
  }
  if (metadata.readState !== 'ready') {
    if (nodeCount || metadata.sourceCount !== null || metadata.resultCount !== null)
      throw Error('Non-ready reads require no rows and unknown counts');
    return;
  }
  if (metadata.resultCount === null) throw Error('Ready reads require resultCount');
  if (metadata.sourceCount !== null && metadata.resultCount > metadata.sourceCount)
    throw Error('resultCount exceeds sourceCount');
  if (nodeCount !== metadata.resultCount) throw Error('Complete tree node count must equal resultCount');
}
