import { describe, expect, it } from 'vitest';
import { createStoragePort } from './storage.ts';
describe('injected optional storage', () => {
  it('reports unavailable and throwing operations rather than swallowing success', () => {
    const port = createStoragePort({
      getItem: () => {
        throw Error('blocked read');
      },
      setItem: () => {
        throw Error('blocked write');
      },
    });
    expect(port.read('key')).toEqual({ ok: false, reason: expect.stringContaining('blocked read') });
    expect(port.write('key', 'value')).toEqual({ ok: false, reason: expect.stringContaining('blocked write') });
    expect(createStoragePort().read('key')).toEqual({ ok: false, reason: expect.any(String) });
  });
  it('delegates to exactly the supplied storage', () => {
    const values = new Map<string, string>();
    const port = createStoragePort({
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    });
    expect(port.read('absent')).toEqual({ ok: true, value: null });
    expect(port.write('a', 'b')).toEqual({ ok: true });
    expect(port.read('a')).toEqual({ ok: true, value: 'b' });
  });
});
describe('separate session storage port', () => {
  it('reads writes removes from only its injected session and reports every failure', async () => {
    const { createSessionStoragePort } = await import('./storage.ts');
    const values = new Map<string, string>();
    const port = createSessionStoragePort({ getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); } });
    expect(port.write('a', 'b')).toEqual({ ok: true }); expect(port.read('a')).toEqual({ ok: true, value: 'b' });
    expect(port.remove('a')).toEqual({ ok: true }); expect(port.read('a')).toEqual({ ok: true, value: null });
    expect(createSessionStoragePort().remove('a')).toMatchObject({ ok: false });
    const failed = createSessionStoragePort({ getItem: () => { throw Error('read'); }, setItem: () => { throw Error('write'); }, removeItem: () => { throw Error('remove'); } });
    expect(failed.read('a')).toMatchObject({ ok: false }); expect(failed.write('a', 'b')).toMatchObject({ ok: false }); expect(failed.remove('a')).toMatchObject({ ok: false });
  });
});
