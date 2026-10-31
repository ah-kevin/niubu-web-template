import { useEffect, useRef, useState } from 'react';
import { Button } from '@niubu/shadcn-ui/button';
import type { TableEditing, TableReorder } from './advanced-types';
import { useOwnedState } from './advanced-state';
import { moveRowId } from './advanced-helpers';

export function useRowEditing<T>(
  config: TableEditing<T> | undefined,
  rows: readonly { id: string; original: T }[],
  enabled: boolean,
) {
  const [id, setId] = useOwnedState(config?.rowId, null);
  const row = rows.find(row => row.id === id);
  const [draft, setDraft] = useState<T | null>(() =>
    row && enabled && config ? config.createDraft(row.original) : null,
  );
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const hasRow = !!row;
  const ownerKey = config?.ownerKey;
  const [boundary, setBoundary] = useState({ id, hasRow, enabled, ownerKey });
  if (
    boundary.id !== id ||
    boundary.hasRow !== hasRow ||
    boundary.enabled !== enabled ||
    boundary.ownerKey !== ownerKey
  ) {
    setBoundary({ id, hasRow, enabled, ownerKey });
    setPending(false);
    setErrors({});
    setDraft(row && enabled && config ? config.createDraft(row.original) : null);
  }
  useEffect(() => {
    operation.current = null;
    return () => operation.current?.abort();
  }, [id, hasRow, enabled, ownerKey]);
  const cancel = () => {
    operation.current?.abort();
    operation.current = null;
    setPending(false);
    setId(null);
    setDraft(null);
    setErrors({});
    if (row) config?.onCancel?.(row.original);
  };
  const save = async () => {
    if (!config || !row || draft === null || pending || !enabled) return;
    const invalid = config.validate(draft);
    setErrors(invalid);
    if (Object.values(invalid).some(Boolean)) return;
    const controller = new AbortController();
    operation.current = controller;
    setPending(true);
    try {
      await config.onSave(draft, { row: row.original, rowId: row.id, signal: controller.signal });
      if (controller.signal.aborted) return;
      setId(null);
      setDraft(null);
    } catch {
      if (!controller.signal.aborted) setErrors({ _row: config.labels.failed });
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setPending(false);
      }
    }
  };
  return {
    id,
    draft,
    pending,
    errors,
    renderCell: (rowId: string, original: T, columnId: string) =>
      config && id === rowId && draft !== null
        ? config.renderCell({
            columnId,
            row: original,
            draft,
            setDraft,
            error: errors[columnId],
            disabled: pending || !enabled,
          })
        : null,
    actions: (rowId: string, original: T) =>
      config &&
      (id === rowId ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={pending || !enabled || draft === null}
            onClick={() => void save()}
          >
            {pending ? config.labels.saving : config.labels.save}
          </Button>
          <Button type="button" variant="link" size="sm" onClick={cancel}>
            {config.labels.cancel}
          </Button>
          {errors._row && (
            <span role="alert" className="text-destructive-text">
              {errors._row}
            </span>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={!enabled || pending || config.canEdit?.(original) === false}
          onClick={() => setId(rowId)}
        >
          {config.labels.edit}
        </Button>
      )),
  };
}

export function useRowReorder<T, R extends { id: string; original: T }>(
  config: TableReorder<T> | undefined,
  rows: readonly R[],
  enabled: boolean,
) {
  const ids = rows.map(row => row.id);
  const key = JSON.stringify(ids);
  const [preview, setPreview] = useState<readonly string[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const [boundary, setBoundary] = useState({ key, enabled });
  if (boundary.key !== key || boundary.enabled !== enabled) {
    setBoundary({ key, enabled });
    setPreview(null);
    setActive(null);
    setPending(false);
    setError(false);
  }
  useEffect(() => {
    operation.current = null;
    return () => operation.current?.abort();
  }, [key, enabled]);
  const cancel = () => {
    if (!operation.current) {
      setPreview(null);
      setActive(null);
    }
  };
  const commit = async (next: readonly string[]) => {
    if (!config || !enabled || pending) return;
    setActive(null);
    setError(false);
    if (next.every((id, i) => id === ids[i])) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setPending(true);
    setPreview(next);
    try {
      await config.onReorder(next, { rows: rows.map(row => row.original), signal: controller.signal });
      if (!controller.signal.aborted) setPreview(null);
    } catch {
      if (!controller.signal.aborted) {
        setPreview(null);
        setError(true);
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setPending(false);
      }
    }
  };
  const order = preview ?? ids;
  const orderedRows = preview ? order.map(id => rows.find(row => row.id === id)!).filter(Boolean) : rows;
  return {
    rows: orderedRows,
    active,
    pending,
    message: error
      ? config?.labels.failed
      : pending
        ? config?.labels.saving
        : active
          ? `${config?.labels.pickedUp} ${order.indexOf(active) + 1} / ${order.length}`
          : !enabled
            ? config?.labels.disabled
            : null,
    drop: (target: string) => {
      if (active) void commit(moveRowId(order, active, target));
    },
    handle: (row: R) =>
      config && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="pattern-reorder-handle"
          aria-label={config.labels.handle(row.original)}
          aria-pressed={active === row.id}
          title={!enabled ? config.labels.disabled : undefined}
          disabled={!enabled || pending}
          draggable={enabled && !pending}
          onDragStart={event => {
            event.dataTransfer.setData('text/plain', row.id);
            event.dataTransfer.effectAllowed = 'move';
            setActive(row.id);
            setPreview(ids);
            setError(false);
          }}
          onDragEnd={cancel}
          onKeyDown={event => {
            if (!enabled || pending) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              if (active === row.id) void commit(order);
              else {
                setActive(row.id);
                setPreview(ids);
                setError(false);
              }
            }
            if (active === row.id && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault();
              const target = order[order.indexOf(row.id) + (event.key === 'ArrowUp' ? -1 : 1)];
              if (target) setPreview(moveRowId(order, row.id, target));
            }
          }}
        >
          <span aria-hidden="true">⠿</span>
        </Button>
      ),
  };
}
