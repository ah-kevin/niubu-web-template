import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createPreferenceManager, PreferenceProvider, preferenceStorageKey } from '@niubu/preferences';
import { registerTablePreferences, useTablePreferences } from './useTablePreferences';

const identity = { storageNamespace: 'sample', product: 'sample', appId: 'sample-web', environment: 'local', identityKey: 'preview' };
const empty = { visibility: {}, sizing: {}, pinning: { start: [], end: [] } };
const schemas = { alpha: ['title', 'date'], beta: ['title', 'status'] };
const options = { storageNamespace: 'sample', tableId: 'alpha', columnIds: schemas.alpha, scopeKey: 'opaque:a', schemas };
function fixture() {
  const data = new Map<string, string>();
  const storage = { read: (key: string) => ({ ok: true as const, value: data.get(key) ?? null }), write: (key: string, value: string) => { data.set(key, value); return { ok: true as const }; } };
  const manager = createPreferenceManager({ identity, storage });
  return { data, storage, manager };
}

it.each(['replace', 'reset'] as const)('retains unvisited B on cold A %s with explicitly supplied schemas', operation => {
  const { data, storage, manager } = fixture();
  const key = preferenceStorageKey({ ...identity, scopeKey: options.scopeKey });
  const beta = { version: 2, value: { ...empty, sizing: { title: 230 } } };
  data.set(key, JSON.stringify({ schemaVersion: 1, extensions: { 'sample.tables.beta': beta }, migrations: [] }));
  const alpha = registerTablePreferences(manager, options);
  expect((operation === 'replace' ? alpha.replace({ ...empty, visibility: { date: false } }) : alpha.reset())).toEqual({ kind: 'persisted' });
  expect(JSON.parse(data.get(key)!).extensions['sample.tables.beta']).toEqual(beta);
  manager.dispose();
  const restored = createPreferenceManager({ identity, storage });
  expect(registerTablePreferences(restored, { ...options, tableId: 'beta', columnIds: schemas.beta }).get()).toEqual(beta.value);
  restored.dispose();
});

it('blocks cold A writes when known B has a future schema and preserves the envelope', () => {
  const { data, manager } = fixture();
  const key = preferenceStorageKey({ ...identity, scopeKey: options.scopeKey });
  const raw = JSON.stringify({ schemaVersion: 1, extensions: { 'sample.tables.beta': { version: 99, value: { opaque: 'retain' } } }, migrations: [] });
  data.set(key, raw);
  expect(registerTablePreferences(manager, options).reset().kind).toBe('memory');
  expect(data.get(key)).toBe(raw);
  manager.dispose();
});

it('reacts to native slice replacement and keeps namespaces and scopes isolated', () => {
  const { manager } = fixture();
  const wrapper = ({ children }: { children: React.ReactNode }) => <PreferenceProvider manager={manager}>{children}</PreferenceProvider>;
  const { result, rerender } = renderHook(({ storageNamespace, scopeKey }) => useTablePreferences({ ...options, storageNamespace, scopeKey }), { wrapper, initialProps: { storageNamespace: 'sample', scopeKey: 'opaque:a' } });
  act(() => { result.current.columnSizing.onChange({ title: 220 }); result.current.columnVisibility.onChange({ date: false }); });
  act(() => result.current.columnSizing.onChange({}));
  expect(result.current.columnSizing.value).toEqual({});
  expect(result.current.columnVisibility.value).toEqual({ date: false });
  rerender({ storageNamespace: 'other', scopeKey: 'opaque:a' });
  expect(result.current.columnVisibility.value).toEqual({});
  rerender({ storageNamespace: 'sample', scopeKey: 'opaque:b' });
  expect(result.current.columnVisibility.value).toEqual({});
  rerender({ storageNamespace: 'sample', scopeKey: 'opaque:a' });
  expect(result.current.columnVisibility.value).toEqual({ date: false });
  act(() => result.current.onResetColumns());
  expect(result.current.columnVisibility.value).toEqual({});
  manager.dispose();
});
