import type { StoragePort } from '@niubu/hooks';
import { parsePreferenceEnvelope, type ParsedPreferenceEnvelope } from './pure.ts';
export type { PreferenceEnvelope } from './pure.ts';
export type PersistenceResult = { kind: 'persisted' } | { kind: 'memory'; reason: string };
export function readEnvelope(storage: StoragePort, key: string): ParsedPreferenceEnvelope {
  const result = storage.read(key);
  return parsePreferenceEnvelope(result.ok ? result.value : null);
}
export function writeConfirmed(storage: StoragePort, key: string, raw: string): PersistenceResult {
  const write = storage.write(key, raw);
  if (!write.ok) return { kind: 'memory', reason: write.reason };
  const read = storage.read(key);
  if (!read.ok) return { kind: 'memory', reason: read.reason };
  return read.value === raw
    ? { kind: 'persisted' }
    : { kind: 'memory', reason: 'Storage readback differs from the written preferences' };
}
