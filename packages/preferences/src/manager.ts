import type { StoragePort } from '@niubu/hooks';
import {
  mergeValidatedPreference,
  resolvePreferences,
  resetPreferences,
  validateCorePreferencePatch,
  type CorePreferences,
  type DeepPartial,
  type PreferenceExtension,
} from '@niubu/core-preferences';
import { readEnvelope, writeConfirmed, type PersistenceResult, type PreferenceEnvelope } from './persistence.ts';

import {
  preferenceStorageKey,
  parsePreferenceEnvelope,
  type PreferenceIdentity,
  type ParsedPreferenceEnvelope,
} from './pure.ts';
export { preferenceStorageKey } from './pure.ts';
export type { PreferenceIdentity } from './pure.ts';
export interface ExtensionHandle<T> {
  get(): T;
  update(next: DeepPartial<T>): PersistenceResult;
  /** Validates and replaces the entire extension value in one persistence attempt. */
  replace(value: T): PersistenceResult;
  reset(): PersistenceResult;
}
export interface PreferenceSnapshot {
  core: CorePreferences;
  persistence: PersistenceResult | null;
}
export interface PreferenceManager {
  readonly identity: PreferenceIdentity;
  readonly storage: StoragePort;
  getSnapshot(): PreferenceSnapshot;
  subscribe(listener: () => void): () => void;
  update(next: DeepPartial<CorePreferences>): PersistenceResult;
  reset(): PersistenceResult;
  registerExtension<T>(definition: PreferenceExtension<T>, options?: { scopeKey: string }): ExtensionHandle<T>;
  hasMigration(marker: string, options?: { scopeKey: string }): boolean;
  /** App-owned legacy migrations only fill absent persisted or user-edited fields. */
  migrate(
    marker: string,
    patch: { core?: DeepPartial<CorePreferences>; extensions?: Record<string, unknown> },
  ): PersistenceResult;
  migrate(
    marker: string,
    patch: { core?: never; extensions: Record<string, unknown> },
    options: { scopeKey: string },
  ): PersistenceResult;
  dispose(): void;
}
type Entry = {
  version: number;
  value: unknown;
  touched: boolean;
  /** Schema registration alone does not create stored display intent. */
  hasPersistenceIntent: boolean;
  validate: (value: unknown) => unknown;
  handle: ExtensionHandle<unknown>;
};
type Bucket = {
  key: string;
  scopeKey: string | undefined;
  stored: ParsedPreferenceEnvelope;
  extensions: Map<string, Entry>;
  migrations: Set<string>;
};
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
/** Schemas validate display data; cloning prevents callers from mutating a stored snapshot. */
const immutable = <T>(value: T): T => freeze(JSON.parse(JSON.stringify(value)) as T);

export function createPreferenceManager(options: {
  identity: PreferenceIdentity;
  storage: StoragePort;
  appDefaults?: DeepPartial<CorePreferences>;
  policy?: DeepPartial<CorePreferences>;
}): PreferenceManager {
  const identity = Object.freeze({ ...options.identity });
  const { storage } = options;
  const appDefaults = options.appDefaults && immutable(validateCorePreferencePatch(options.appDefaults));
  const policy = options.policy && immutable(validateCorePreferencePatch(options.policy));
  const buckets = new Map<string, Bucket>();
  function bucketFor(scopeKey?: string): Bucket {
    const registryKey = JSON.stringify(scopeKey ?? null);
    let bucket = buckets.get(registryKey);
    if (!bucket) {
      const key = preferenceStorageKey({ ...identity, scopeKey });
      const stored = readEnvelope(storage, key);
      bucket = { key, scopeKey, stored, extensions: new Map(), migrations: new Set(stored.migrations) };
      buckets.set(registryKey, bucket);
    }
    return bucket;
  }
  const global = bucketFor();
  const listeners = new Set<() => void>();
  let disposed = false;
  let coreTouched = false;
  let snapshot: PreferenceSnapshot = freeze({
    core: resolvePreferences({ appDefaults, persisted: global.stored.core, policy }),
    persistence: null,
  });
  const disposedResult = (): PersistenceResult => ({ kind: 'memory', reason: 'Preference manager is disposed' });
  function finish(result: PersistenceResult): PersistenceResult {
    snapshot = freeze({ core: snapshot.core, persistence: result });
    listeners.forEach(listener => listener());
    return result;
  }
  function envelope(bucket: Bucket): PreferenceEnvelope {
    return {
      schemaVersion: 1,
      ...(bucket.scopeKey === undefined ? { core: snapshot.core } : {}),
      extensions: Object.fromEntries(
        [...bucket.extensions]
          .filter(([, entry]) => entry.hasPersistenceIntent)
          .map(([namespace, entry]) => [namespace, { version: entry.version, value: entry.value }]),
      ),
      migrations: [...bucket.migrations],
    };
  }
  function persist(bucket: Bucket): PersistenceResult {
    // Another tab/newer owner can write after manager creation. Preserve cached and current guards.
    const read = storage.read(bucket.key);
    if (!read.ok) return { kind: 'memory', reason: read.reason };
    const current = parsePreferenceEnvelope(read.value);
    for (const stored of [bucket.stored, current]) {
      if (stored.writeBlocked)
        return {
          kind: 'memory',
          reason: 'Stored preference envelope requires a supported schema version before persistence',
        };
      if (Object.keys(stored.extensions).some(namespace => !bucket.extensions.has(namespace)))
        return { kind: 'memory', reason: 'Stored preference extensions require registered schemas before persistence' };
      if (
        Object.entries(stored.extensions).some(
          ([namespace, entry]) => entry.version > bucket.extensions.get(namespace)!.version,
        )
      )
        return {
          kind: 'memory',
          reason: 'Stored preference extensions require a supported schema version before persistence',
        };
    }
    const value = envelope(bucket);
    const result = writeConfirmed(storage, bucket.key, JSON.stringify(value));
    if (result.kind === 'persisted') bucket.stored = value;
    return result;
  }
  const manager: PreferenceManager = {
    identity,
    storage,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(next) {
      if (disposed) return disposedResult();
      coreTouched = true;
      snapshot = freeze({
        ...snapshot,
        core: resolvePreferences({
          appDefaults,
          persisted: mergeValidatedPreference(snapshot.core, validateCorePreferencePatch(next)),
          policy,
        }),
      });
      return finish(persist(global));
    },
    reset() {
      if (disposed) return disposedResult();
      coreTouched = true;
      snapshot = freeze({ ...snapshot, core: resetPreferences({ appDefaults, policy }) });
      return finish(persist(global));
    },
    registerExtension<T>(definition: PreferenceExtension<T>, scopeOptions?: { scopeKey: string }): ExtensionHandle<T> {
      if (disposed) throw Error('Preference manager is disposed');
      if (
        !definition.namespace ||
        ['__proto__', 'constructor', 'prototype'].includes(definition.namespace) ||
        !Number.isSafeInteger(definition.version) ||
        definition.version < 1
      )
        throw Error('Invalid preference extension definition');
      const bucket = bucketFor(scopeOptions?.scopeKey);
      const existing = bucket.extensions.get(definition.namespace);
      if (existing) {
        if (existing.version !== definition.version)
          throw Error('Preference extension is already registered with another version');
        return existing.handle as ExtensionHandle<T>;
      }
      const defaults = immutable(definition.validate(definition.defaults));
      const stored = bucket.stored.extensions[definition.namespace];
      let value = defaults;
      if (stored && stored.version <= definition.version) {
        try {
          value = immutable(
            definition.validate(
              stored.version === definition.version ? stored.value : definition.migrate(stored.value, stored.version),
            ),
          );
        } catch {
          /* Damaged or unsupported extension data restores validated defaults. */
        }
      }
      const entry: Entry = {
        version: definition.version,
        value,
        touched: false,
        hasPersistenceIntent: Boolean(stored),
        validate: definition.validate,
        handle: undefined as unknown as ExtensionHandle<unknown>,
      };
      function change(next: T): PersistenceResult {
        if (disposed) return disposedResult();
        try {
          entry.value = immutable(definition.validate(next));
        } catch {
          return finish({ kind: 'memory', reason: 'Preference extension rejected the value' });
        }
        entry.touched = true;
        entry.hasPersistenceIntent = true;
        return finish(persist(bucket));
      }
      const handle: ExtensionHandle<T> = {
        get: () => entry.value as T,
        update: next => change(mergeValidatedPreference(entry.value as T, next)),
        replace: change,
        reset: () => change(defaults),
      };
      entry.handle = handle as ExtensionHandle<unknown>;
      bucket.extensions.set(definition.namespace, entry);
      return handle;
    },
    hasMigration: (marker, scopeOptions) => bucketFor(scopeOptions?.scopeKey).migrations.has(marker),
    migrate(
      marker: string,
      patch: { core?: DeepPartial<CorePreferences>; extensions?: Record<string, unknown> },
      scopeOptions?: { scopeKey: string },
    ) {
      if (disposed) return disposedResult();
      const bucket = bucketFor(scopeOptions?.scopeKey);
      if (bucket.stored.writeBlocked)
        return finish({
          kind: 'memory',
          reason: 'Stored preference envelope requires a supported schema version before migration',
        });
      if (scopeOptions && patch.core !== undefined)
        return finish({ kind: 'memory', reason: 'Scoped migrations cannot change core preferences' });
      if (
        scopeOptions &&
        (!patch.extensions ||
          Object.keys(patch.extensions).length === 0 ||
          Object.keys(patch.extensions).some(namespace => !bucket.extensions.has(namespace)))
      )
        return finish({ kind: 'memory', reason: 'Scoped migration extensions require registered schemas' });
      if (bucket.migrations.has(marker)) return { kind: 'persisted' };
      if (patch.core && !global.stored.core && !coreTouched)
        snapshot = freeze({
          ...snapshot,
          core: resolvePreferences({ appDefaults, persisted: patch.core, policy }),
        });
      for (const [namespace, value] of Object.entries(patch.extensions ?? {})) {
        const entry = bucket.extensions.get(namespace);
        if (entry && !bucket.stored.extensions[namespace] && !entry.touched) {
          try {
            entry.value = immutable(entry.validate(value));
            entry.hasPersistenceIntent = true;
          } catch {
            return finish({ kind: 'memory', reason: 'Legacy preference extension rejected the value' });
          }
        }
      }
      const dataResult = persist(bucket);
      if (dataResult.kind === 'memory') return finish(dataResult);
      // A marker is attempted only after the data envelope has passed exact readback.
      bucket.migrations.add(marker);
      const markerResult = persist(bucket);
      if (markerResult.kind === 'memory') bucket.migrations.delete(marker);
      return finish(markerResult);
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
  return manager;
}
