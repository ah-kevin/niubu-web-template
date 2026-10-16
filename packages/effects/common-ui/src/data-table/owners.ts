import { functionalUpdate, type ColumnSizingState, type Updater } from '@tanstack/react-table';
import { clampColumnWidth } from './preferences';
import type { ListSlices, SliceOwner } from './types';
const initial = <S>(owner: SliceOwner<S> | undefined): S | undefined =>
  owner?.kind === 'internal' ? owner.initial : undefined;
const controlled = <S>(owner: SliceOwner<S> | undefined): S | undefined =>
  owner?.kind === 'controlled' ? owner.value : undefined;
/** Undefined slices are omitted, so SDK internal ownership remains intact. */
export function listOwnership(props: ListSlices, columnIds: readonly string[]) {
  const sizing = props.columnSizing;
  return {
    initialState: {
      ...(initial(props.sorting) !== undefined ? { sorting: initial(props.sorting) } : {}),
      ...(props.pagination?.kind !== 'controlled'
        ? { pagination: initial(props.pagination) ?? { pageIndex: 0, pageSize: 25 } }
        : {}),
      ...(initial(props.columnVisibility) !== undefined ? { columnVisibility: initial(props.columnVisibility) } : {}),
      ...(initial(props.columnSizing) !== undefined ? { columnSizing: initial(props.columnSizing) } : {}),
      ...(initial(props.columnPinning) !== undefined ? { columnPinning: initial(props.columnPinning) } : {}),
    },
    state: {
      ...(controlled(props.sorting) !== undefined ? { sorting: controlled(props.sorting) } : {}),
      ...(controlled(props.pagination) !== undefined ? { pagination: controlled(props.pagination) } : {}),
      ...(controlled(props.columnVisibility) !== undefined
        ? { columnVisibility: controlled(props.columnVisibility) }
        : {}),
      ...(controlled(props.columnSizing) !== undefined ? { columnSizing: controlled(props.columnSizing) } : {}),
      ...(controlled(props.columnPinning) !== undefined ? { columnPinning: controlled(props.columnPinning) } : {}),
    },
    ...(props.sorting?.kind === 'controlled' ? { onSortingChange: props.sorting.onChange } : {}),
    ...(props.pagination?.kind === 'controlled' ? { onPaginationChange: props.pagination.onChange } : {}),
    ...(props.columnVisibility?.kind === 'controlled'
      ? { onColumnVisibilityChange: props.columnVisibility.onChange }
      : {}),
    // Native drag updates can exceed display bounds and include group ancestors.
    // Normalize the updater sent to its single existing owner; do not mirror this slice.
    ...(sizing?.kind === 'controlled'
      ? {
          onColumnSizingChange: (updater: Updater<ColumnSizingState>) =>
            sizing.onChange(previous =>
              Object.fromEntries(
                Object.entries(functionalUpdate(updater, previous))
                  .filter(([id]) => columnIds.includes(id))
                  .map(([id, width]) => [id, clampColumnWidth(width)]),
              ),
            ),
        }
      : {}),
    ...(props.columnPinning?.kind === 'controlled' ? { onColumnPinningChange: props.columnPinning.onChange } : {}),
  };
}
export function validateListOwnership(props: ListSlices, columnIds: readonly string[]): void {
  const value = <S>(owner: SliceOwner<S> | undefined): S | undefined =>
    owner?.kind === 'controlled' ? owner.value : owner?.initial;
  const visibility = value(props.columnVisibility);
  if (visibility && columnIds.every(id => visibility[id] === false))
    throw Error('At least one column must remain visible');
  const sizes = value(props.columnSizing);
  if (
    sizes &&
    Object.entries(sizes).some(
      ([id, width]) => !columnIds.includes(id) || !Number.isFinite(width) || width < 80 || width > 640,
    )
  )
    throw Error('Column width must be between 80 and 640 for known columns');
  const pins = value(props.columnPinning);
  if (
    pins &&
    ([...pins.start, ...pins.end].some(id => !columnIds.includes(id)) ||
      new Set([...pins.start, ...pins.end]).size !== pins.start.length + pins.end.length)
  )
    throw Error('Pinned column IDs must be known and unique');
  const pagination = value(props.pagination);
  if (
    pagination &&
    (!Number.isSafeInteger(pagination.pageIndex) ||
      pagination.pageIndex < 0 ||
      !Number.isSafeInteger(pagination.pageSize) ||
      pagination.pageSize <= 0)
  )
    throw Error('Invalid table pagination');
}

/** Changing ownership starts a fresh native instance; data/state updates do not change this key. */
export function listInstanceKey(props: ListSlices & { model: { kind: string } }): string {
  return [
    props.model.kind,
    props.sorting?.kind ?? 'internal',
    props.pagination?.kind ?? 'internal',
    props.columnVisibility?.kind ?? 'internal',
    props.columnPinning?.kind ?? 'internal',
    props.columnSizing?.kind ?? 'internal',
  ].join(':');
}
