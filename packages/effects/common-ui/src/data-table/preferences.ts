import { isPreferenceRecord, type PreferenceExtension } from '@niubu/core-preferences';
import type { ColumnPinningState, ColumnSizingState, ColumnVisibilityState } from './types';
import { isSafeColumnId } from './identity';
export interface TablePreferences {
  visibility: ColumnVisibilityState;
  sizing: ColumnSizingState;
  pinning: ColumnPinningState;
}
export const clampColumnWidth = (width: number): number => Math.max(80, Math.min(640, width));
export function cleanTablePreferences(value: unknown, columnIds: readonly string[]): TablePreferences {
  const allowed = new Set(columnIds.filter(isSafeColumnId));
  const input = isPreferenceRecord(value) ? value : {};
  const visibility: ColumnVisibilityState = {};
  const sizing: ColumnSizingState = {};
  if (isPreferenceRecord(input.visibility))
    for (const [id, value] of Object.entries(input.visibility))
      if (allowed.has(id) && typeof value === 'boolean') visibility[id] = value;
  if (columnIds.length && columnIds.every(id => visibility[id] === false)) visibility[columnIds[0]] = true;
  if (isPreferenceRecord(input.sizing))
    for (const [id, value] of Object.entries(input.sizing))
      if (allowed.has(id) && typeof value === 'number' && Number.isFinite(value)) sizing[id] = clampColumnWidth(value);
  const pinning = isPreferenceRecord(input.pinning) ? input.pinning : {};
  const ids = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))]
      : [];
  const start = ids(pinning.start);
  const end = ids(pinning.end).filter(id => !start.includes(id));
  return { visibility, sizing, pinning: { start, end } };
}
export function tablePreferences(
  tableId: string,
  columnIds: readonly string[],
  storageNamespace: string,
  defaults?: TablePreferences,
): PreferenceExtension<TablePreferences> {
  if (typeof storageNamespace !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(storageNamespace))
    throw Error('storageNamespace must be an explicit app namespace without scope');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(tableId)) throw Error('tableId must be a stable table/column-set ID without scope');
  if (!columnIds.length || columnIds.some(id => !isSafeColumnId(id)) || new Set(columnIds).size !== columnIds.length)
    throw Error('Column IDs must be safe and unique');
  const validate = (value: unknown) => cleanTablePreferences(value, columnIds);
  const validDefaults = validate(defaults);
  return {
    namespace: `${storageNamespace}.tables.${tableId}`,
    version: 2,
    defaults: validDefaults,
    validate,
    // Old physical LTR state is imported only by the app-owned legacy migration.
    migrate: () => validDefaults,
  };
}
