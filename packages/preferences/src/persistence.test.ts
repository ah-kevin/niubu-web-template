import { describe, it, expect } from 'vitest';
import { createStoragePort } from '@niubu/hooks';
import { writeConfirmed, readEnvelope } from './persistence.ts';
describe('confirmed display persistence', () => {
  it('requires write and exact readback and defines damaged schema fallback', () => {
    const raw = '{"schemaVersion":1,"extensions":{},"migrations":[]}';
    expect(
      writeConfirmed({ read: () => ({ ok: true, value: 'different' }), write: () => ({ ok: true }) }, 'key', raw),
    ).toEqual({ kind: 'memory', reason: expect.any(String) });
    expect(readEnvelope(createStoragePort({ getItem: () => '{broken', setItem: () => {} }), 'key')).toEqual({
      extensions: {},
      migrations: [],
    });
  });
});
