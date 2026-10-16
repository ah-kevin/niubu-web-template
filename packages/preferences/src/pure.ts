import {
  isPreferenceRecord,
  parseThemeSnapshot,
  resolvePreferences,
  validateCorePreferencePatch,
  type DeepPartial,
  type CorePreferences,
} from '@niubu/core-preferences';
export type PreferenceIdentity = {
  storageNamespace: string;
  product: string;
  appId: string;
  environment: string;
  identityKey: string;
  scopeKey?: string;
};
export const preferenceStorageKey = (identity: PreferenceIdentity) =>
  `${identity.storageNamespace}.preferences:` +
  encodeURIComponent(
    JSON.stringify([
      identity.product,
      identity.appId,
      identity.environment,
      identity.identityKey,
      identity.scopeKey ?? null,
    ]),
  );
export type PreferenceEnvelope = {
  schemaVersion: 1;
  core?: DeepPartial<CorePreferences>;
  extensions: Record<string, { version: number; value: unknown }>;
  migrations: string[];
};
export type ParsedPreferenceEnvelope = Omit<PreferenceEnvelope, 'schemaVersion'> & { writeBlocked?: 'future-version' };
export function parsePreferenceEnvelope(json: string | null): ParsedPreferenceEnvelope {
  const empty = { extensions: {}, migrations: [] };
  if (json === null) return empty;
  try {
    const raw: unknown = JSON.parse(json);
    if (isPreferenceRecord(raw) && Number.isSafeInteger(raw.schemaVersion) && Number(raw.schemaVersion) > 1)
      return { ...empty, writeBlocked: 'future-version' };
    if (
      !isPreferenceRecord(raw) ||
      raw.schemaVersion !== 1 ||
      !isPreferenceRecord(raw.extensions) ||
      !Array.isArray(raw.migrations) ||
      !raw.migrations.every(marker => typeof marker === 'string')
    )
      return empty;
    const extensions = Object.fromEntries(
      Object.entries(raw.extensions).filter(
        ([namespace, entry]) =>
          namespace.length > 0 &&
          !['__proto__', 'constructor', 'prototype'].includes(namespace) &&
          isPreferenceRecord(entry) &&
          Number.isSafeInteger(entry.version) &&
          Number(entry.version) > 0 &&
          Object.hasOwn(entry, 'value'),
      ),
    );
    return {
      ...(isPreferenceRecord(raw.core) ? { core: validateCorePreferencePatch(raw.core) } : {}),
      extensions: extensions as PreferenceEnvelope['extensions'],
      migrations: [...new Set(raw.migrations)],
    };
  } catch {
    return empty;
  }
}

export type PreferenceThemeSnapshotOptions = {
  storage: { read: (key: string) => { ok: true; value: string | null } | { ok: false; reason: string } };
  identity: PreferenceIdentity;
  appDefaults?: DeepPartial<CorePreferences>;
  policy?: DeepPartial<CorePreferences>;
  legacy?: { migration: string; read: () => DeepPartial<CorePreferences> | undefined };
};

/** Pure prepaint projection: one global bucket, app-owned legacy fallback, no manager or writes. */
export function readPreferenceThemeSnapshot({
  storage,
  identity,
  appDefaults,
  policy,
  legacy,
}: PreferenceThemeSnapshotOptions) {
  const result = storage.read(preferenceStorageKey({ ...identity, scopeKey: undefined }));
  const envelope = parsePreferenceEnvelope(result.ok ? result.value : null);
  let persisted = envelope.core;
  if (!envelope.writeBlocked && !persisted && legacy && !envelope.migrations.includes(legacy.migration))
    persisted = legacy.read();
  const core = resolvePreferences({ appDefaults, persisted, policy });
  return parseThemeSnapshot({ schemaVersion: 2, mode: core.theme.mode, density: core.density, appearance: core.theme });
}
