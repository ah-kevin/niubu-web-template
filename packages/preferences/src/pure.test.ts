import { expect, it } from 'vitest';
import * as preferences from './index.ts';
import { readEnvelope } from './persistence.ts';
import * as pure from '@niubu/preferences/pure';

it('shares the envelope JSON parser with persistence and drops damaged core and unsafe extensions', () => {
  const parse = (preferences as unknown as { parsePreferenceEnvelope?: (json: string | null) => unknown }).parsePreferenceEnvelope;
  expect(typeof parse).toBe('function');
  expect(parse).toBe(pure.parsePreferenceEnvelope);
  expect(preferences.preferenceStorageKey).toBe(pure.preferenceStorageKey);
  for (const raw of [null, '{bad', '[]']) {
    expect(parse!(raw)).toEqual({ extensions: {}, migrations: [] });
    expect(readEnvelope({ read: () => ({ ok: true, value: raw }), write: () => ({ ok: true }) }, 'fixed')).toEqual(parse!(raw));
  }
  const raw = JSON.stringify({ schemaVersion: 1, core: { theme: { mode: 'dark', token: 'no' }, density: 'invalid', sidebar: { collapsed: true }, grants: ['no'] }, extensions: { good: { version: 2, value: { a: 1 } }, constructor: { version: 1, value: 'bad' }, invalid: { version: 0, value: 1 } }, migrations: ['a', 'a'] });
  expect(parse!(raw)).toEqual({ core: { theme: { mode: 'dark' }, sidebar: { collapsed: true } }, extensions: { good: { version: 2, value: { a: 1 } } }, migrations: ['a'] });
  expect(parse!('{"schemaVersion":1,"extensions":{},"migrations":[]}')).toEqual({ extensions: {}, migrations: [] });
});

it('marks a future envelope read-only instead of treating it as an empty writable bucket', () => {
  expect(pure.parsePreferenceEnvelope('{"schemaVersion":2,"extensions":{},"migrations":[]}')).toEqual({ extensions: {}, migrations: [], writeBlocked: 'future-version' });
});

it('changes only the prefix when the app namespace changes and keeps the encoded tuple', () => {
  const identity = { storageNamespace: 'sample', product: 'sample', appId: 'sample-web', environment: 'local', identityKey: 'preview' };
  expect(pure.preferenceStorageKey(identity)).toBe('sample.preferences:%5B%22sample%22%2C%22sample-web%22%2C%22local%22%2C%22preview%22%2Cnull%5D');
  expect(pure.preferenceStorageKey({ ...identity, storageNamespace: 'other' })).toBe('other.preferences:%5B%22sample%22%2C%22sample-web%22%2C%22local%22%2C%22preview%22%2Cnull%5D');
  expect(pure.preferenceStorageKey({ ...identity, scopeKey: '' })).toBe('sample.preferences:%5B%22sample%22%2C%22sample-web%22%2C%22local%22%2C%22preview%22%2C%22%22%5D');
});

it('reads the global theme with explicit app defaults, policy and no persistence capability', () => {
  const identity = { storageNamespace: 'sample', product: 'sample', appId: 'sample-web', environment: 'local', identityKey: 'preview', scopeKey: 'ignored' };
  const reads: string[] = [];
  const raw = '{"schemaVersion":1,"core":{"theme":{"mode":"dark","radius":0},"density":"compact"},"extensions":{},"migrations":[]}';
  const storage = { read: (key: string) => { reads.push(key); return { ok: true as const, value: raw }; } };
  const snapshot = pure.readPreferenceThemeSnapshot({ storage, identity, appDefaults: { theme: { mode: 'system' } }, policy: { theme: { mode: 'light' } } });
  expect(snapshot).toMatchObject({ schemaVersion: 2, mode: 'light', density: 'compact', appearance: { mode: 'light', radius: 0 } });
  expect(reads).toEqual(['sample.preferences:%5B%22sample%22%2C%22sample-web%22%2C%22local%22%2C%22preview%22%2Cnull%5D']);
});

it('calls the app legacy fallback only for an absent unmigrated core, protecting future data', () => {
  const identity = { storageNamespace: 'sample', product: 'sample', appId: 'sample-web', environment: 'local', identityKey: 'preview' };
  for (const [raw, expectedMode, expectedCalls] of [
    [null, 'light', 1],
    ['{"schemaVersion":1,"extensions":{},"migrations":["display-v1"]}', 'dark', 0],
    ['{"schemaVersion":1,"core":{},"extensions":{},"migrations":[]}', 'dark', 0],
    ['{"schemaVersion":2,"core":{"theme":{"mode":"light"}},"extensions":{},"migrations":[]}', 'dark', 0],
  ] as const) {
    let calls = 0;
    const snapshot = pure.readPreferenceThemeSnapshot({
      identity, storage: { read: () => ({ ok: true, value: raw }) }, appDefaults: { theme: { mode: 'dark' } },
      legacy: { migration: 'display-v1', read: () => { calls++; return { theme: { mode: 'light' } }; } },
    });
    expect(snapshot.mode).toBe(expectedMode);
    expect(calls).toBe(expectedCalls);
  }
});
