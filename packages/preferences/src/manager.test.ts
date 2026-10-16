import { describe, expect, it, vi } from 'vitest';
import type { PreferenceExtension } from '@niubu/core-preferences';
import { createStoragePort } from '@niubu/hooks';
import { createPreferenceManager, preferenceStorageKey, type PreferenceIdentity } from './index.ts';
const identity: PreferenceIdentity = {
  storageNamespace: 'sample',
  product: 'sample',
  appId: 'sample-web',
  environment: 'local',
  identityKey: 'preview',
};
const extension: PreferenceExtension<{ layout: 'balanced' | 'wide' }> = {
  namespace: 'test.layout',
  version: 2,
  defaults: { layout: 'balanced' },
  validate: value => ({ layout: (value as { layout?: unknown })?.layout === 'wide' ? 'wide' : 'balanced' }),
  migrate: (value, version) =>
    version === 1 ? { layout: value === 'wide' ? 'wide' : 'balanced' } : { layout: 'balanced' },
};
function fixture() {
  const data = new Map<string, string>();
  const storage = createStoragePort({
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  return { data, storage };
}
describe('instance preference ownership', () => {
  it('applies memory immediately and diagnoses write or readback failure', () => {
    for (const storage of [
      { read: () => ({ ok: true as const, value: null }), write: () => ({ ok: false as const, reason: 'blocked' }) },
      { read: () => ({ ok: true as const, value: null }), write: () => ({ ok: true as const }) },
      { read: () => ({ ok: false as const, reason: 'unreadable' }), write: () => ({ ok: true as const }) },
    ]) {
      const manager = createPreferenceManager({ identity, storage });
      const listener = vi.fn();
      manager.subscribe(listener);
      expect(manager.update({ density: 'compact' })).toEqual({ kind: 'memory', reason: expect.any(String) });
      expect(manager.getSnapshot().core.density).toBe('compact');
      expect(listener).toHaveBeenCalledOnce();
      expect(manager.getSnapshot().persistence?.kind).toBe('memory');
    }
  });
  it('persists and restores only validated core; defaults and policy survive reset', () => {
    const { data, storage } = fixture();
    const options = {
      identity,
      storage,
      appDefaults: { density: 'compact' as const, locale: 'en-US' as const },
      policy: { theme: { mode: 'light' as const } },
    };
    const manager = createPreferenceManager(options);
    expect(manager.update({ theme: { mode: 'dark' }, density: 'standard' })).toEqual({ kind: 'persisted' });
    const restored = createPreferenceManager(options);
    expect(restored.getSnapshot().core).toMatchObject({
      theme: { mode: 'light' },
      density: 'standard',
      locale: 'en-US',
    });
    expect(restored.reset()).toEqual({ kind: 'persisted' });
    expect(restored.getSnapshot().core.density).toBe('compact');
    manager.update(
      JSON.parse('{"density":"compact","credentials":"x","grants":{},"rows":[],"drafts":{},"derivedTheme":"dark"}'),
    );
    const raw = data.get(preferenceStorageKey(identity))!;
    expect(raw).not.toMatch(/credentials|grants|rows|drafts|derivedTheme/);
  });
  it('encodes tuple identity and isolates app, environment and identity across instances', () => {
    const { storage } = fixture();
    const a = createPreferenceManager({ identity, storage });
    a.update({ density: 'compact' });
    for (const other of [
      { ...identity, storageNamespace: 'other' },
      { ...identity, appId: 'other' },
      { ...identity, environment: 'staging' },
      { ...identity, identityKey: 'user:1/a' },
    ])
      expect(createPreferenceManager({ identity: other, storage }).getSnapshot().core.density).toBe('standard');
    expect(
      decodeURIComponent(
        preferenceStorageKey({ ...identity, identityKey: 'a/b:你好' }).slice('sample.preferences:'.length),
      ),
    ).toBe(JSON.stringify(['sample', 'sample-web', 'local', 'a/b:你好', null]));
    const b = createPreferenceManager({ identity, storage });
    a.update({ density: 'standard' });
    expect(b.getSnapshot().core.density).toBe('compact');
  });
  it('keeps global core and extension apart from fixed scoped handles', () => {
    const { data, storage } = fixture();
    const manager = createPreferenceManager({ identity: { ...identity, scopeKey: 'ignored-for-core' }, storage });
    const global = manager.registerExtension(extension),
      a = manager.registerExtension(extension, { scopeKey: 'region-a' }),
      b = manager.registerExtension(extension, { scopeKey: 'region-b' });
    a.update({ layout: 'wide' });
    b.update({ layout: 'balanced' });
    a.update({ layout: 'wide' });
    manager.update({ density: 'compact' });
    global.update({ layout: 'wide' });
    expect(b.get()).toEqual({ layout: 'balanced' });
    expect(data.get(preferenceStorageKey({ ...identity, scopeKey: 'region-a' }))).not.toContain('core');
    expect(JSON.parse(data.get(preferenceStorageKey(identity))!).extensions[extension.namespace].value).toEqual({
      layout: 'wide',
    });
    const restored = createPreferenceManager({ identity, storage });
    expect(restored.registerExtension(extension, { scopeKey: 'region-a' }).get().layout).toBe('wide');
    expect(restored.registerExtension(extension, { scopeKey: 'region-b' }).get().layout).toBe('balanced');
    expect(manager.registerExtension(extension, { scopeKey: 'region-a' })).toBe(a);
    a.reset();
    expect(a.get()).toEqual(extension.defaults);
  });
  it('migrates known lower extension versions and defaults unknown versions or invalid envelopes', () => {
    const { data, storage } = fixture();
    const key = preferenceStorageKey(identity);
    for (const [version, value, expected] of [
      [1, 'wide', 'wide'],
      [99, { layout: 'wide' }, 'balanced'],
    ] as const) {
      data.set(
        key,
        JSON.stringify({ schemaVersion: 1, extensions: { [extension.namespace]: { version, value } }, migrations: [] }),
      );
      expect(createPreferenceManager({ identity, storage }).registerExtension(extension).get().layout).toBe(expected);
    }
    for (const raw of [
      '{broken',
      JSON.stringify({ schemaVersion: 9, core: { density: 'compact' }, extensions: {}, migrations: [] }),
      JSON.stringify({ schemaVersion: 1, core: { density: 'compact' }, extensions: [], migrations: [] }),
    ]) {
      data.set(key, raw);
      expect(createPreferenceManager({ identity, storage }).getSnapshot().core.density).toBe('standard');
    }
  });
  it('unsubscribes and disposes without leaking into another instance', () => {
    const { storage } = fixture();
    const a = createPreferenceManager({ identity, storage }),
      b = createPreferenceManager({ identity, storage });
    const listener = vi.fn();
    const unsubscribe = a.subscribe(listener);
    unsubscribe();
    a.update({ density: 'compact' });
    expect(listener).not.toHaveBeenCalled();
    a.subscribe(listener);
    a.dispose();
    expect(a.update({ density: 'standard' }).kind).toBe('memory');
    expect(listener).not.toHaveBeenCalled();
    expect(b.getSnapshot().core.density).toBe('standard');
  });
});

describe('deferred extension schemas retain independent stored namespaces', () => {
  const A = { ...extension, namespace: 'test.A' };
  const B = { ...extension, namespace: 'test.B' };
  it.each(['scoped-A', 'global-A', 'global-core'] as const)(
    'keeps disk untouched and memory current for %s until B is registered',
    mode => {
      const { data, storage: port } = fixture();
      const storage = { read: port.read, write: vi.fn(port.write) };
      const scope = mode === 'scoped-A' ? { scopeKey: 'region-a' } : undefined;
      const key = preferenceStorageKey({ ...identity, scopeKey: scope?.scopeKey });
      const one = createPreferenceManager({ identity, storage });
      const a1 = one.registerExtension(A, scope),
        b1 = one.registerExtension(B, scope);
      a1.update({ layout: 'wide' });
      b1.update({ layout: 'wide' });
      const before = data.get(key);
      const two = createPreferenceManager({ identity, storage });
      const a2 = two.registerExtension(A, scope);
      const listener = vi.fn();
      two.subscribe(listener);
      storage.write.mockClear();
      const result = mode === 'global-core' ? two.update({ density: 'compact' }) : a2.update({ layout: 'balanced' });
      expect(result).toEqual({ kind: 'memory', reason: expect.any(String) });
      expect(two.getSnapshot().persistence).toEqual(result);
      expect(listener).toHaveBeenCalledOnce();
      expect(storage.write).not.toHaveBeenCalled();
      expect(data.get(key)).toBe(before);
      if (mode === 'global-core') expect(two.getSnapshot().core.density).toBe('compact');
      else expect(a2.get().layout).toBe('balanced');
      expect(createPreferenceManager({ identity, storage }).registerExtension(B, scope).get().layout).toBe('wide');
      const validate = vi.fn(B.validate);
      const b2 = two.registerExtension({ ...B, validate }, scope);
      expect(b2.get().layout).toBe('wide');
      expect(validate).toHaveBeenCalledWith({ layout: 'wide' });
      expect(mode === 'global-core' ? two.update({ theme: { mode: 'dark' } }) : a2.update({})).toEqual({
        kind: 'persisted',
      });
      const saved = JSON.parse(data.get(key)!);
      expect(saved.extensions[A.namespace].value.layout).toBe(mode === 'global-core' ? 'wide' : 'balanced');
      expect(saved.extensions[B.namespace].value.layout).toBe('wide');
      if (scope) expect(saved).not.toHaveProperty('core');
      else if (mode === 'global-core') expect(saved.core.density).toBe('compact');
      const recreated = createPreferenceManager({ identity, storage });
      expect(recreated.registerExtension(A, scope).get().layout).toBe(mode === 'global-core' ? 'wide' : 'balanced');
      expect(recreated.registerExtension(B, scope).get().layout).toBe('wide');
    },
  );
  it.each(['core-reset', 'extension-reset', 'migration'] as const)(
    'guards %s without dropping a deferred namespace or bypassing migration confirmation',
    operation => {
      const { data, storage: port } = fixture();
      const storage = { read: port.read, write: vi.fn(port.write) };
      const one = createPreferenceManager({ identity, storage });
      const a1 = one.registerExtension(A),
        b1 = one.registerExtension(B);
      one.update({ density: 'compact' });
      a1.update({ layout: 'wide' });
      b1.update({ layout: 'wide' });
      const key = preferenceStorageKey(identity),
        before = data.get(key);
      const two = createPreferenceManager({ identity, storage }),
        a2 = two.registerExtension(A);
      if (operation === 'migration') {
        two.update({ density: 'standard' });
        a2.update({ layout: 'balanced' });
      }
      storage.write.mockClear();
      const listener = vi.fn();
      two.subscribe(listener);
      const result =
        operation === 'core-reset'
          ? two.reset()
          : operation === 'extension-reset'
            ? a2.reset()
            : two.migrate('test-legacy-v1', {});
      expect(result).toEqual({ kind: 'memory', reason: expect.any(String) });
      expect(listener).toHaveBeenCalledOnce();
      expect(data.get(key)).toBe(before);
      expect(storage.write).not.toHaveBeenCalled();
      expect(two.hasMigration('test-legacy-v1')).toBe(false);
      expect(operation === 'core-reset' ? two.getSnapshot().core.density : a2.get().layout).toBe(
        operation === 'core-reset' ? 'standard' : 'balanced',
      );
      expect(two.registerExtension(B).get().layout).toBe('wide');
      expect(operation === 'migration' ? two.migrate('test-legacy-v1', {}) : two.update({})).toEqual({
        kind: 'persisted',
      });
      const saved = JSON.parse(data.get(key)!);
      expect(saved.extensions[B.namespace].value.layout).toBe('wide');
      expect(saved.extensions[A.namespace].value.layout).toBe(operation === 'core-reset' ? 'wide' : 'balanced');
      expect(saved.core.density).toBe(operation === 'extension-reset' ? 'compact' : 'standard');
      if (operation === 'migration') {
        expect(saved.migrations).toContain('test-legacy-v1');
        expect(two.hasMigration('test-legacy-v1')).toBe(true);
      }
      expect(createPreferenceManager({ identity, storage }).registerExtension(B).get().layout).toBe('wide');
    },
  );
  it('keeps missing schemas local to their bucket and writes only newly validated values after registration', () => {
    const { data, storage } = fixture();
    const scope = { scopeKey: 'region-a' },
      key = preferenceStorageKey({ ...identity, ...scope });
    data.set(
      key,
      JSON.stringify({
        schemaVersion: 1,
        extensions: {
          [A.namespace]: { version: A.version, value: { layout: 'wide' } },
          [B.namespace]: { version: B.version, value: { layout: 'wide', untrusted: 'must not be replayed' } },
        },
        migrations: [],
      }),
    );
    const manager = createPreferenceManager({ identity, storage }),
      a = manager.registerExtension(A, scope);
    const before = data.get(key);
    expect(a.reset().kind).toBe('memory');
    expect(data.get(key)).toBe(before);
    expect(manager.update({ density: 'compact' })).toEqual({ kind: 'persisted' });
    expect(manager.registerExtension(A, { scopeKey: 'region-b' }).update({ layout: 'wide' })).toEqual({
      kind: 'persisted',
    });
    expect(data.get(key)).toBe(before);
    const b = manager.registerExtension(B, scope);
    expect(b.get()).toEqual({ layout: 'wide' });
    expect(a.update({})).toEqual({ kind: 'persisted' });
    expect(data.get(key)).not.toContain('untrusted');
    expect(JSON.parse(data.get(key)!)).not.toHaveProperty('core');
  });
});

describe('scoped extension migration', () => {
  it('isolates the same marker and extensions in each scope and the global bucket', () => {
    const { data, storage } = fixture();
    const manager = createPreferenceManager({ identity, storage });
    const a = manager.registerExtension(extension, { scopeKey: 'opaque:a' });
    const b = manager.registerExtension(extension, { scopeKey: 'opaque:b' });
    manager.registerExtension(extension);
    expect(
      manager.migrate(
        'legacy-table',
        { extensions: { [extension.namespace]: { layout: 'wide' } } },
        { scopeKey: 'opaque:a' },
      ),
    ).toEqual({ kind: 'persisted' });
    expect(a.get().layout).toBe('wide');
    expect(b.get().layout).toBe('balanced');
    expect(manager.hasMigration('legacy-table', { scopeKey: 'opaque:a' })).toBe(true);
    expect(manager.hasMigration('legacy-table', { scopeKey: 'opaque:b' })).toBe(false);
    expect(manager.hasMigration('legacy-table')).toBe(false);
    expect(data.has(preferenceStorageKey(identity))).toBe(false);
    expect(data.get(preferenceStorageKey({ ...identity, scopeKey: 'opaque:a' }))).not.toContain('core');
  });
  it('does not confirm a scoped marker when data or marker readback fails', () => {
    for (const failWrite of [1, 2]) {
      const data = new Map<string, string>();
      let writes = 0;
      const storage = createStoragePort({
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => {
          writes++;
          if (writes !== failWrite) data.set(key, value);
        },
      });
      const manager = createPreferenceManager({ identity, storage });
      manager.registerExtension(extension, { scopeKey: 'a' });
      expect(
        manager.migrate('legacy', { extensions: { [extension.namespace]: { layout: 'wide' } } }, { scopeKey: 'a' })
          .kind,
      ).toBe('memory');
      expect(manager.hasMigration('legacy', { scopeKey: 'a' })).toBe(false);
      expect(data.has(preferenceStorageKey(identity))).toBe(false);
    }
  });
  it('rejects unknown migration namespaces and scoped core patches without erasing data', () => {
    const { data, storage } = fixture();
    const manager = createPreferenceManager({ identity, storage });
    manager.registerExtension(extension, { scopeKey: 'a' });
    expect(manager.migrate('unknown', { extensions: { missing: { layout: 'wide' } } }, { scopeKey: 'a' }).kind).toBe(
      'memory',
    );
    expect(manager.hasMigration('unknown', { scopeKey: 'a' })).toBe(false);
    // @ts-expect-error scoped migration may not patch global core preferences
    expect(manager.migrate('core', { core: { density: 'compact' } }, { scopeKey: 'a' }).kind).toBe('memory');
    expect(manager.getSnapshot().core.density).toBe('standard');
    expect(data.size).toBe(0);
  });
});
it('replaces a validated extension value without retaining removed nested map entries', () => {
  const { storage } = fixture();
  const manager = createPreferenceManager({ identity, storage });
  const map: PreferenceExtension<{ widths: Record<string, number> }> = {
    namespace: 'test.widths',
    version: 1,
    defaults: { widths: {} },
    validate: value => value as { widths: Record<string, number> },
    migrate: () => ({ widths: {} }),
  };
  const handle = manager.registerExtension(map, { scopeKey: 'a' });
  handle.update({ widths: { id: 200 } });
  expect(handle.replace({ widths: {} })).toEqual({ kind: 'persisted' });
  expect(handle.get()).toEqual({ widths: {} });
  expect(createPreferenceManager({ identity, storage }).registerExtension(map, { scopeKey: 'a' }).get()).toEqual({
    widths: {},
  });
});
it('performs one replacement write, clones caller data, and reports failed exact readback', () => {
  const data = new Map<string, string>();
  let writes = 0;
  let fail = false;
  const storage = createStoragePort({
    getItem: key => (fail ? null : (data.get(key) ?? null)),
    setItem: (key, value) => {
      writes++;
      data.set(key, value);
    },
  });
  const manager = createPreferenceManager({ identity, storage });
  const handle = manager.registerExtension(extension, { scopeKey: 'a' });
  const value: { layout: 'balanced' | 'wide' } = { layout: 'wide' };
  expect(handle.replace(value)).toEqual({ kind: 'persisted' });
  expect(writes).toBe(1);
  value.layout = 'balanced';
  expect(handle.get().layout).toBe('wide');
  fail = true;
  expect(handle.replace(value).kind).toBe('memory');
  expect(writes).toBe(2);
  expect(handle.get().layout).toBe('balanced');
  expect(manager.getSnapshot().persistence?.kind).toBe('memory');
  expect(data.has(preferenceStorageKey(identity))).toBe(false);
});


it.each([undefined, 'opaque:current'])('keeps registered-only defaults absent while persisting actual migration data in scope %s', scopeKey => {
  const { data, storage } = fixture();
  const manager = createPreferenceManager({ identity, storage });
  const scoped = scopeKey === undefined ? undefined : { scopeKey };
  const unused = { ...extension, namespace: 'test.unvisited' };
  const selected = manager.registerExtension(extension, scoped);
  manager.registerExtension(unused, scoped);
  expect(selected.reset()).toEqual({ kind: 'persisted' });
  const key = preferenceStorageKey({ ...identity, scopeKey });
  expect(JSON.parse(data.get(key)!).extensions).toEqual({ [extension.namespace]: { version: 2, value: extension.defaults } });
  expect(scopeKey === undefined ? manager.migrate('legacy-default', { extensions: { [unused.namespace]: extension.defaults } }) : manager.migrate('legacy-default', { extensions: { [unused.namespace]: extension.defaults } }, { scopeKey })).toEqual({ kind: 'persisted' });
  const envelope = JSON.parse(data.get(key)!);
  expect(envelope.extensions[unused.namespace]).toEqual({ version: 2, value: extension.defaults });
  expect(envelope.migrations).toContain('legacy-default');
  manager.dispose();
});

it.each(['future-envelope', 'unknown-extension', 'future-extension'] as const)('preserves newer external %s written after this instance opened', kind => {
  const { data, storage } = fixture();
  const write = vi.spyOn(storage, 'write');
  const manager = createPreferenceManager({ identity, storage });
  manager.registerExtension(extension);
  const key = preferenceStorageKey(identity);
  const raw = JSON.stringify({ schemaVersion: kind === 'future-envelope' ? 2 : 1, core: { theme: { mode: 'light' } }, extensions: kind === 'unknown-extension' ? { external: { version: 1, value: 'preserve-me' } } : { [extension.namespace]: { version: kind === 'future-extension' ? 3 : 2, value: { layout: 'wide' } } }, migrations: [] });
  data.set(key, raw);
  expect(manager.update({ density: 'compact' })).toEqual({ kind: 'memory', reason: expect.any(String) });
  expect(manager.getSnapshot().core.density).toBe('compact');
  expect(data.get(key)).toBe(raw);
  expect(write).not.toHaveBeenCalled();
});
it('does not blindly write when the same-bucket preflight read becomes unavailable', () => {
  const { storage } = fixture();
  const manager = createPreferenceManager({ identity, storage });
  vi.spyOn(storage, 'read').mockReturnValue({ ok: false, reason: 'unavailable' });
  const write = vi.spyOn(storage, 'write');
  expect(manager.update({ density: 'compact' })).toEqual({ kind: 'memory', reason: 'unavailable' });
  expect(write).not.toHaveBeenCalled();
  expect(manager.getSnapshot().core.density).toBe('compact');
});
it('preserves an unsupported envelope from startup through update/reset/migration', () => {
  const { data, storage } = fixture(), key = preferenceStorageKey(identity);
  const raw = JSON.stringify({ schemaVersion: 2, extensions: { future: { version: 1, value: 'preserve' } } });
  data.set(key, raw);
  const manager = createPreferenceManager({ identity, storage });
  expect(manager.update({ density: 'compact' }).kind).toBe('memory');
  expect(manager.reset().kind).toBe('memory');
  expect(manager.migrate('legacy', { core: { theme: { mode: 'light' } } }).kind).toBe('memory');
  expect(data.get(key)).toBe(raw);
});
