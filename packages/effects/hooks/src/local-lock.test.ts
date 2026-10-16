import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createLocalLock, type LockCrypto, type LockIdentity } from './local-lock';
import type { StoragePort } from './storage';

const identity: LockIdentity = { storageNamespace: 'fixture', appId: 'demo', environment: 'test', identityKey: 'one' };
const signal = () => new AbortController().signal;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function memory() {
  const values = new Map<string, string>();
  const storage: StoragePort = { read: key => ({ ok: true, value: values.get(key) ?? null }), write: (key, value) => { values.set(key, value); return { ok: true }; } };
  return { values, storage };
}
const crypto: LockCrypto = {
  randomBytes: size => new Uint8Array(size).fill(7),
  derive: async password => new Uint8Array(32).fill(password === 'fixture phrase' ? 1 : 2),
};

describe('identity local lock', () => {
  it('publishes only a persisted salted lock and restores it without persisting the phrase', async () => {
    const { values, storage } = memory();
    const derive = vi.fn(crypto.derive);
    const owner = createLocalLock({ identity, storage, crypto: { ...crypto, derive } });
    expect(await owner.lock('fixture phrase', signal())).toBe(true);
    expect(owner.getSnapshot()).toEqual({ locked: true, pending: false, errorCode: null });
    expect(derive).toHaveBeenCalledWith('fixture phrase', new Uint8Array(16).fill(7), 210_000);
    const encoded = [...values.values()][0]!;
    expect(encoded).not.toContain('fixture phrase');
    expect(JSON.parse([...values.keys()][0]!)).toEqual(['fixture', 'demo', 'test', 'one', 'local-lock', 1]);
    const restored = createLocalLock({ identity, storage, crypto });
    expect(restored.getSnapshot().locked).toBe(true);
    expect(await restored.unlock('wrong phrase', signal())).toBe(false);
    expect(restored.getSnapshot().locked).toBe(true);
    expect(restored.getSnapshot().errorCode).toBe('invalid-password');
    expect(await restored.unlock('fixture phrase', signal())).toBe(true);
    expect(createLocalLock({ identity, storage, crypto }).getSnapshot().locked).toBe(false);
    owner.dispose(); restored.dispose();
  });

  it('isolates identity, app, environment and namespace and clears only its own key using null', async () => {
    const { values, storage } = memory();
    const owner = createLocalLock({ identity, storage, crypto });
    await owner.lock('fixture phrase', signal());
    for (const field of ['identityKey', 'appId', 'environment', 'storageNamespace'] as const) {
      const other = createLocalLock({ identity: { ...identity, [field]: 'other' }, storage, crypto });
      expect(other.getSnapshot().locked).toBe(false);
      other.dispose();
    }
    values.set('unrelated', 'preserve');
    expect(owner.clear()).toBe(true);
    expect([...values.values()]).toEqual(['null', 'preserve']);
    expect(createLocalLock({ identity, storage, crypto }).getSnapshot()).toEqual({ locked: false, pending: false, errorCode: null });
    owner.dispose();
  });

  it.each(['cancel', 'abort', 'dispose', 'replace'] as const)('rejects late derive after %s without a storage write', async action => {
    const { values, storage } = memory();
    const gate = deferred<Uint8Array>();
    const owner = createLocalLock({ identity, storage, crypto: { ...crypto, derive: () => gate.promise } });
    const controller = new AbortController();
    const pending = owner.lock('fixture phrase', controller.signal);
    expect(owner.getSnapshot().pending).toBe(true);
    if (action === 'abort') controller.abort();
    else if (action === 'replace') { void owner.lock('new phrase', signal()); }
    else owner[action]();
    gate.resolve(new Uint8Array(32));
    expect(await pending).toBe(false);
    if (action !== 'replace') expect(values.size).toBe(0);
    owner.dispose();
  });

  it('keeps a known lock on storage and crypto failures and never publishes raw error text', async () => {
    const { storage } = memory();
    let failWrite = false;
    const port: StoragePort = { read: storage.read, write: (key, value) => failWrite ? { ok: false, reason: 'fixture phrase' } : storage.write(key, value) };
    const owner = createLocalLock({ identity, storage: port, crypto });
    await owner.lock('fixture phrase', signal());
    failWrite = true;
    expect(await owner.unlock('fixture phrase', signal())).toBe(false);
    expect(owner.getSnapshot().locked).toBe(true);
    expect(owner.clear()).toBe(false);
    expect(owner.getSnapshot().locked).toBe(true);
    expect(JSON.stringify(owner.getSnapshot())).not.toContain('fixture phrase');
    const bad = createLocalLock({ identity, storage, crypto: { ...crypto, derive: async () => { throw new Error('fixture phrase'); } } });
    expect(await bad.unlock('fixture phrase', signal())).toBe(false);
    expect(bad.getSnapshot()).toEqual({ locked: true, pending: false, errorCode: 'crypto-unavailable' });
    owner.dispose(); bad.dispose();
  });

  it('rejects malformed records and unavailable reads without establishing a lock', async () => {
    for (const value of ['{}', '[]', '{"locked":true}', 'invalid', 'false']) {
      const storage: StoragePort = { read: () => ({ ok: true, value }), write: vi.fn(() => ({ ok: true as const })) };
      const owner = createLocalLock({ identity, storage, crypto });
      expect(owner.getSnapshot().errorCode).toBe('invalid-record');
      expect(await owner.lock('fixture phrase', signal())).toBe(false);
      expect(storage.write).not.toHaveBeenCalled();
      owner.dispose();
    }
    const owner = createLocalLock({ identity, storage: { read: () => { throw new Error('fixture phrase'); }, write: () => ({ ok: true }) }, crypto });
    expect(owner.getSnapshot().errorCode).toBe('storage-unavailable');
  });

  it('roundtrips a synthetic phrase through actual native WebCrypto PBKDF2', async () => {
    vi.stubGlobal('crypto', webcrypto);
    try {
      const { storage, values } = memory();
      const owner = createLocalLock({ identity, storage });
      expect(await owner.lock('synthetic native roundtrip', signal())).toBe(true);
      const record = JSON.parse([...values.values()][0]!);
      expect(record).toMatchObject({ version: 1, kdf: 'PBKDF2', hashAlgorithm: 'SHA-256', iterations: 210_000, locked: true });
      expect(atob(record.salt)).toHaveLength(16);
      expect(atob(record.hash)).toHaveLength(32);
      const restored = createLocalLock({ identity, storage });
      expect(await restored.unlock('not the phrase', signal())).toBe(false);
      expect(await restored.unlock('synthetic native roundtrip', signal())).toBe(true);
      owner.dispose(); restored.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});

it('does not establish an anonymous owner by clearing its initial identity diagnostic', async () => {
  const { storage } = memory();
  const owner = createLocalLock({ identity: { ...identity, identityKey: '' }, storage, crypto });
  expect(owner.getSnapshot().errorCode).toBe('invalid-identity');
  expect(owner.clear()).toBe(false);
  expect(await owner.lock('fixture phrase', signal())).toBe(false);
  expect(owner.getSnapshot().locked).toBe(false);
  owner.dispose();
});
