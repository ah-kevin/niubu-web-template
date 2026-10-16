import { useMemo, useSyncExternalStore } from 'react';
import { tablePreferences, type TablePreferences } from './preferences';
import { functionalUpdate } from '@tanstack/react-table';
import type { ColumnSizingState, ColumnVisibilityState, ColumnPinningState, Updater } from './types';
import { usePreferenceManager, type PreferenceManager } from '@niubu/preferences';
export interface TablePreferenceOptions {
  storageNamespace: string;
  schemas?: Readonly<Record<string, readonly string[]>>;
  tableId: string;
  columnIds: readonly string[];
  scopeKey: string;
  defaults?: TablePreferences;
}
export function registerTablePreferences(manager: PreferenceManager, options: TablePreferenceOptions) {
  if (!options.scopeKey) throw Error('Table preferences require the current opaque scopeKey');
  const handle = manager.registerExtension(
    tablePreferences(options.tableId, options.columnIds, options.storageNamespace, options.defaults),
    {
      scopeKey: options.scopeKey,
    },
  );
  if (options.schemas && Object.hasOwn(options.schemas, options.tableId)) {
    for (const [tableId, columnIds] of Object.entries(options.schemas)) {
      if (tableId !== options.tableId)
        manager.registerExtension(tablePreferences(tableId, columnIds, options.storageNamespace), {
          scopeKey: options.scopeKey,
        });
    }
  }
  return handle;
}
/** All three display slices share one scoped extension; the native table receives one owner per slice. */
export function useTablePreferences({
  tableId,
  columnIds,
  scopeKey,
  defaults,
  storageNamespace,
  schemas,
}: TablePreferenceOptions) {
  const manager = usePreferenceManager();
  const handle = useMemo(
    () => registerTablePreferences(manager, { tableId, columnIds, scopeKey, defaults, storageNamespace, schemas }),
    [manager, tableId, columnIds, scopeKey, defaults, storageNamespace, schemas],
  );
  const value = useSyncExternalStore(manager.subscribe, handle.get, handle.get);
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  return {
    columnVisibility: {
      kind: 'controlled' as const,
      value: value.visibility,
      onChange: (updater: Updater<ColumnVisibilityState>) => {
        const current = handle.get();
        handle.replace({ ...current, visibility: functionalUpdate(updater, current.visibility) });
      },
    },
    columnSizing: {
      kind: 'controlled' as const,
      value: value.sizing,
      onChange: (updater: Updater<ColumnSizingState>) => {
        const current = handle.get();
        handle.replace({ ...current, sizing: functionalUpdate(updater, current.sizing) });
      },
    },
    columnPinning: {
      kind: 'controlled' as const,
      value: value.pinning,
      onChange: (updater: Updater<ColumnPinningState>) => {
        const current = handle.get();
        handle.replace({ ...current, pinning: functionalUpdate(updater, current.pinning) });
      },
    },
    onResetColumns: () => {
      handle.reset();
    },
    persistence: snapshot.persistence,
  };
}
