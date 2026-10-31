import { useMemo, useState } from 'react';
import { functionalUpdate, type Updater } from '@tanstack/react-table';
import type { ColumnFilterValue, MultiColumnFilterValues, TableColumnFilters } from './advanced-types';
import type { SliceOwner } from './types';

/** Like native slice owners, a mode change starts from the new internal initial value. */
export function useOwnedState<S>(owner: SliceOwner<S> | undefined, initial: S) {
  const kind = owner?.kind ?? 'internal';
  const initialValue = owner?.kind === 'internal' ? (owner.initial ?? initial) : initial;
  const [state, setState] = useState({ kind, value: initialValue });
  if (state.kind !== kind) setState({ kind, value: initialValue });
  const value = owner?.kind === 'controlled' ? owner.value : state.kind === kind ? state.value : initialValue;
  const update = (next: Updater<S>) => {
    if (owner?.kind === 'controlled') owner.onChange(next);
    else
      setState(previous => ({
        kind,
        value: functionalUpdate(next, previous.kind === kind ? previous.value : initialValue),
      }));
  };
  return [value, update] as const;
}
export const filterValues = (value: ColumnFilterValue | undefined): readonly string[] =>
  typeof value === 'string' ? (value ? [value] : []) : (value ?? []);
export const hasFilterValue = (value: ColumnFilterValue | undefined): boolean => filterValues(value).length > 0;

export function useColumnFilters<T>(rows: readonly T[], config?: TableColumnFilters<T>) {
  // Single-value owners continue to receive strings, including when a filter is cleared.
  const owner = config?.state;
  const singleValues = (values: MultiColumnFilterValues) =>
    Object.fromEntries(
      Object.entries(values).map(([id, value]) => [id, typeof value === 'string' ? value : (value[0] ?? '')]),
    );
  const stateOwner: SliceOwner<MultiColumnFilterValues> | undefined =
    config?.selection === 'multiple'
      ? config.state
      : !owner
        ? undefined
        : owner.kind === 'internal'
          ? { kind: 'internal', initial: owner.initial }
          : {
              kind: 'controlled',
              value: owner.value,
              onChange: next => {
                if (config?.state?.kind === 'controlled')
                  config.state.onChange(previous => singleValues(functionalUpdate(next, previous)));
              },
            };
  const [values, update] = useOwnedState<MultiColumnFilterValues>(stateOwner, {});
  const filtered = useMemo(
    () =>
      config?.mode === 'local'
        ? rows.filter(row =>
            Object.keys(config.fields).every(id => {
              const choices = filterValues(values[id]);
              return !choices.length || choices.some(value => config.matches(row, id, value));
            }),
          )
        : rows,
    [rows, config, values],
  );
  return { rows: filtered, values, update };
}
