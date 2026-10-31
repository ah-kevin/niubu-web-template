import { useMemo, useState } from 'react';
import { functionalUpdate, type Updater } from '@tanstack/react-table';
import type { ColumnFilterValues, TableColumnFilters } from './advanced-types';
import type { SliceOwner } from './types';

export function useOwnedState<S>(owner: SliceOwner<S> | undefined, initial: S) {
  const [internal, setInternal] = useState(owner?.kind === 'internal' ? (owner.initial ?? initial) : initial);
  const value = owner?.kind === 'controlled' ? owner.value : internal;
  const update = (next: Updater<S>) => {
    if (owner?.kind === 'controlled') owner.onChange(next);
    else setInternal(previous => functionalUpdate(next, previous));
  };
  return [value, update] as const;
}
export function useColumnFilters<T>(rows: readonly T[], config?: TableColumnFilters<T>) {
  const [values, update] = useOwnedState<ColumnFilterValues>(config?.state, {});
  const filtered = useMemo(
    () =>
      config?.mode === 'local'
        ? rows.filter(row =>
            Object.entries(config.fields).every(([id]) => !values[id] || config.matches(row, id, values[id])),
          )
        : rows,
    [rows, config, values],
  );
  return { rows: filtered, values, update };
}
