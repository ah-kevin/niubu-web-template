import type { StoragePort } from './storage';

export type LockIdentity = Readonly<{
  storageNamespace: string;
  appId: string;
  environment: string;
  identityKey: string;
}>;
export type LockCrypto = {
  randomBytes(size: number): Uint8Array;
  derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array>;
};
export type LockSnapshot = Readonly<{ locked: boolean; pending: boolean; errorCode: string | null }>;
type LockRecord = {
  version: 1;
  kdf: 'PBKDF2';
  hashAlgorithm: 'SHA-256';
  iterations: 210000;
  salt: string;
  hash: string;
  locked: boolean;
};
const iterations = 210_000;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function decode(value: unknown, size: number): Uint8Array {
  if (typeof value !== 'string') throw new Error('invalid-record');
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (bytes.length !== size || encode(bytes) !== value) throw new Error('invalid-record');
  return bytes;
}
function readRecord(value: string | null): LockRecord | null {
  if (value === null) return null;
  const record: unknown = JSON.parse(value);
  if (record === null) return null;
  if (typeof record !== 'object' || Array.isArray(record)) throw new Error('invalid-record');
  const candidate = record as Record<string, unknown>;
  if (
    Object.keys(candidate).sort().join(',') !== 'hash,hashAlgorithm,iterations,kdf,locked,salt,version' ||
    candidate.version !== 1 ||
    candidate.kdf !== 'PBKDF2' ||
    candidate.hashAlgorithm !== 'SHA-256' ||
    candidate.iterations !== iterations ||
    typeof candidate.locked !== 'boolean'
  )
    throw new Error('invalid-record');
  decode(candidate.salt, 16);
  decode(candidate.hash, 32);
  return candidate as LockRecord;
}
async function nativeDerive(password: string, salt: Uint8Array, assertCurrent: () => void) {
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  assertCurrent();
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  assertCurrent();
  return new Uint8Array(bits);
}

/** Instance owner; storage and its identity never change during its lifetime. */
export function createLocalLock({
  identity,
  storage,
  crypto,
}: {
  identity: LockIdentity;
  storage: StoragePort;
  crypto?: LockCrypto;
}) {
  const key = JSON.stringify([
    identity.storageNamespace,
    identity.appId,
    identity.environment,
    identity.identityKey,
    'local-lock',
    1,
  ]);
  let record: LockRecord | null = null;
  let snapshot: LockSnapshot = { locked: false, pending: false, errorCode: null };
  const validIdentity = Object.values(identity).every(value => typeof value === 'string' && value.trim().length > 0);
  let usable = validIdentity;
  let disposed = false;
  let epoch = 0;
  let retire: (() => void) | undefined;
  const listeners = new Set<() => void>();
  function publish(change: Partial<LockSnapshot>) {
    snapshot = Object.freeze({ ...snapshot, ...change });
    for (const listener of listeners) listener();
  }
  if (!usable) snapshot = { ...snapshot, errorCode: 'invalid-identity' };
  else {
    try {
      const result = storage.read(key);
      if (!result.ok) {
        usable = false;
        snapshot = { ...snapshot, errorCode: 'storage-unavailable' };
      } else {
        try {
          record = readRecord(result.value);
          snapshot = { ...snapshot, locked: record?.locked ?? false };
        } catch {
          usable = false;
          snapshot = { ...snapshot, errorCode: 'invalid-record' };
        }
      }
    } catch {
      usable = false;
      snapshot = { ...snapshot, errorCode: 'storage-unavailable' };
    }
  }
  function cancel() {
    epoch++;
    retire?.();
    retire = undefined;
    if (!disposed && snapshot.pending) publish({ pending: false });
  }
  function persist(next: LockRecord | null) {
    try {
      if (!storage.write(key, JSON.stringify(next)).ok) throw new Error();
      record = next;
      return true;
    } catch {
      publish({ pending: false, errorCode: 'storage-unavailable' });
      return false;
    }
  }
  async function run(password: string, signal: AbortSignal, locking: boolean): Promise<boolean> {
    if (disposed || !usable || signal.aborted) return false;
    cancel();
    if (locking && snapshot.locked) return false;
    if (!locking && (!snapshot.locked || !record)) return false;
    const operation = ++epoch;
    const current = () => !disposed && epoch === operation && !signal.aborted;
    const assertCurrent = () => {
      if (!current()) throw new Error('retired');
    };
    let resolveRetired!: (value: null) => void;
    const retired = new Promise<null>(resolve => {
      resolveRetired = resolve;
    });
    retire = () => resolveRetired(null);
    const abort = () => {
      if (epoch === operation) cancel();
    };
    signal.addEventListener('abort', abort, { once: true });
    publish({ pending: true, errorCode: null });
    try {
      const salt = locking
        ? (crypto?.randomBytes(16) ?? globalThis.crypto.getRandomValues(new Uint8Array(16)))
        : decode(record!.salt, 16);
      if (salt.length !== 16) throw new Error();
      assertCurrent();
      const hash = await Promise.race([
        crypto ? crypto.derive(password, salt, iterations) : nativeDerive(password, salt, assertCurrent),
        retired,
      ]);
      if (!current() || hash === null) return false;
      if (hash.length !== 32) throw new Error();
      if (!locking) {
        const expected = decode(record!.hash, 32);
        let difference = 0;
        for (let index = 0; index < expected.length; index++) difference |= expected[index]! ^ hash[index]!;
        if (difference !== 0) {
          publish({ pending: false, errorCode: 'invalid-password' });
          return false;
        }
      }
      assertCurrent();
      const next: LockRecord = {
        version: 1,
        kdf: 'PBKDF2',
        hashAlgorithm: 'SHA-256',
        iterations,
        salt: encode(salt),
        hash: encode(hash),
        locked: locking,
      };
      if (!persist(next)) return false;
      if (!current()) return false;
      publish({ locked: locking, pending: false, errorCode: null });
      return true;
    } catch {
      if (current()) publish({ pending: false, errorCode: 'crypto-unavailable' });
      return false;
    } finally {
      signal.removeEventListener('abort', abort);
      if (epoch === operation) retire = undefined;
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    lock: (password: string, signal: AbortSignal) => run(password, signal, true),
    unlock: (password: string, signal: AbortSignal) => run(password, signal, false),
    cancel,
    clear() {
      if (disposed || !validIdentity) return false;
      cancel();
      if (!persist(null)) return false;
      usable = true;
      publish({ locked: false, pending: false, errorCode: null });
      return true;
    },
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      listeners.clear();
    },
  };
}
export type LocalLock = ReturnType<typeof createLocalLock>;
