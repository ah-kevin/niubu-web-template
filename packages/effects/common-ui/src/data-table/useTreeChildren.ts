import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RowData } from '@tanstack/react-table';
import type { TreeListTableProps } from './types';
import { validateTreeRows } from './identity';

export type TreeLoad<T> = { row: T; status: 'loading' | 'ready' | 'error'; children?: readonly T[] };

export function useTreeChildren<T extends RowData>(props: TreeListTableProps<T>) {
  const [loads, setLoads] = useState(new Map<string, TreeLoad<T>>());
  const pending = useRef(new Map<string, { row: T; controller: AbortController }>());
  const current = useRef(props);
  const cache = useRef(loads);
  useLayoutEffect(() => {
    current.current = props;
    cache.current = loads;
  }, [props, loads]);
  const { getRowId, getSubRows: staticChildren } = props;
  const getSubRows = useCallback(
    (row: T, index: number) => {
      const entry = loads.get(getRowId(row));
      return entry?.row === row && entry.status === 'ready' ? entry.children : staticChildren(row, index);
    },
    [loads, getRowId, staticChildren],
  );

  useEffect(
    () => () => {
      for (const { controller } of pending.current.values()) controller.abort();
      pending.current.clear();
    },
    [],
  );

  useEffect(() => {
    const present = new Set<T>();
    function visit(rows: readonly T[]) {
      rows.forEach((row, index) => {
        present.add(row);
        visit(getSubRows(row, index) ?? []);
      });
    }
    visit(props.model.rows);
    for (const [id, request] of pending.current) {
      if (!present.has(request.row)) {
        request.controller.abort();
        pending.current.delete(id);
      }
    }
  }, [props.model.rows, getSubRows]);

  const load = useCallback((row: T, retry = false) => {
    const options = current.current;
    const lazy = options.tree?.lazy;
    const id = options.getRowId(row);
    const old = cache.current.get(id);
    if (
      !lazy ||
      !lazy.hasChildren(row) ||
      pending.current.has(id) ||
      (old?.row === row && (old.status === 'ready' || (!retry && old.status === 'error'))) ||
      options.getSubRows(row, 0) !== undefined
    )
      return;
    const controller = new AbortController();
    pending.current.set(id, { row, controller });
    cache.current = new Map(cache.current).set(id, { row, status: 'loading' });
    setLoads(cache.current);
    void (async () => {
      try {
        const children = await lazy.loadChildren(row, { signal: controller.signal });
        if (controller.signal.aborted || pending.current.get(id)?.controller !== controller) return;
        const latest = current.current;
        const readChildren = (candidate: T, index: number): readonly T[] | undefined => {
          if (candidate === row) return children;
          const entry = cache.current.get(latest.getRowId(candidate));
          return entry?.row === candidate && entry.status === 'ready'
            ? entry.children
            : latest.getSubRows(candidate, index);
        };
        validateTreeRows(latest.model.rows, latest.getRowId, readChildren);
        cache.current = new Map(cache.current).set(id, { row, status: 'ready', children });
        setLoads(cache.current);
      } catch {
        if (!controller.signal.aborted && pending.current.get(id)?.controller === controller) {
          cache.current = new Map(cache.current).set(id, { row, status: 'error' });
          setLoads(cache.current);
        }
      } finally {
        if (pending.current.get(id)?.controller === controller) pending.current.delete(id);
      }
    })();
  }, []);
  return { loads, getSubRows, load };
}
