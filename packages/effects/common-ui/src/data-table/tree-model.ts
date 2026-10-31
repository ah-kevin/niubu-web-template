import type { RowSelectionState } from '@tanstack/react-table';

export function searchTree<T>(
  rows: readonly T[],
  children: (row: T, index: number) => readonly T[] | undefined,
  label: (row: T) => string,
  query: string,
) {
  const visible = new Set<T>();
  const expanded = new Set<T>();
  const term = query.trim().toLocaleLowerCase();
  let matchCount = 0;
  function visit(nodes: readonly T[]) {
    let matches = false;
    nodes.forEach((row, index) => {
      const childMatch = visit(children(row, index) ?? []);
      if (childMatch) expanded.add(row);
      const ownMatch = label(row).toLocaleLowerCase().includes(term);
      if (ownMatch) matchCount++;
      if (childMatch || ownMatch) {
        visible.add(row);
        matches = true;
      }
    });
    return matches;
  }
  if (term) visit(rows);
  return { active: Boolean(term), visible, expanded, matchCount };
}

export function treeSelection<T>(
  rows: readonly T[],
  children: (row: T, index: number) => readonly T[] | undefined,
  id: (row: T) => string,
  selected: RowSelectionState,
  disabled: (row: T) => boolean = () => false,
) {
  const states = new Map<string, { checked: boolean; mixed: boolean; disabled: boolean }>();
  const indices = new Map<T, number>();
  const materialized: RowSelectionState = { ...selected };
  function visit(
    row: T,
    index: number,
    inherited: boolean,
    blocked: boolean,
  ): { checked: boolean; mixed: boolean; disabled: boolean } {
    indices.set(row, index);
    const key = id(row);
    const isDisabled = blocked || disabled(row);
    const own = selected[key] ?? inherited;
    const descendants = (children(row, index) ?? []).map((child, i) => visit(child, i, own, isDisabled));
    const enabled = descendants.filter(state => !state.disabled);
    const checked = isDisabled ? selected[key] === true : enabled.length ? enabled.every(state => state.checked) : own;
    const mixed = !isDisabled && !checked && enabled.some(state => state.checked || state.mixed);
    const state = { checked, mixed, disabled: isDisabled };
    states.set(key, state);
    if (!isDisabled) {
      if (checked) materialized[key] = true;
      else delete materialized[key];
    }
    return state;
  }
  const roots = rows.map((row, i) => visit(row, i, false, false));
  const enabled = roots.filter(state => !state.disabled);
  return {
    states,
    all: enabled.length > 0 && enabled.every(state => state.checked),
    some: enabled.some(state => state.checked || state.mixed),
    disabled: enabled.length === 0,
    toggle(target: T | undefined, checked: boolean): RowSelectionState {
      const next = { ...materialized };
      function apply(row: T, index: number) {
        if (states.get(id(row))?.disabled) return;
        if (checked) next[id(row)] = true;
        else delete next[id(row)];
        (children(row, index) ?? []).forEach(apply);
      }
      if (target) apply(target, indices.get(target) ?? 0);
      else rows.forEach(apply);
      // Reconcile ancestors from materialized child IDs without inheriting a stale parent selection.
      function reconcile(row: T, index: number) {
        if (states.get(id(row))?.disabled) return;
        const enabledChildren = (children(row, index) ?? []).filter(child => !states.get(id(child))?.disabled);
        enabledChildren.forEach(child => reconcile(child, indices.get(child) ?? 0));
        if (enabledChildren.length) {
          if (enabledChildren.every(child => next[id(child)])) next[id(row)] = true;
          else delete next[id(row)];
        }
      }
      rows.forEach(reconcile);
      return next;
    },
    materialized,
  };
}
