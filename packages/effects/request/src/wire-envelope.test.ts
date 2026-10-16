import { expect, it } from 'vitest';
import { readWireEnvelope } from './wire-envelope';

it.each([200, 201, 299])('accepts only numeric zero with HTTP %i', status => {
  expect(readWireEnvelope({ code: 0, data: null, message: '' }, status)).toEqual({ ok: true, data: null });
});

it.each([
  { code: '0', status: 200, expected: '0' },
  { code: 5, status: 200, expected: '5' },
  { code: -1.5, status: 200, expected: '-1.5' },
  { code: 'DENIED', status: 403, expected: 'DENIED' },
  { code: 0, status: 401, expected: '0' },
  { code: 0, status: 500, expected: '0' },
])('returns a stable string error code for %j', ({ code, status, expected }) => {
  expect(readWireEnvelope({ code, data: { reason: 'controlled' }, message: 'Failed' }, status)).toEqual({
    ok: false,
    error: { kind: 'http', status, code: expected, message: 'Failed', details: { reason: 'controlled' } },
  });
});

it.each([
  null,
  [],
  { data: 7 },
  { error: { code: 'DENIED' } },
  { code: 0, message: 'ok' },
  { code: 0, data: 7 },
  { code: 0, data: 7, message: null },
  { code: true, data: 7, message: 'ok' },
  { code: '', data: 7, message: 'ok' },
  { code: '  ', data: 7, message: 'ok' },
  { code: NaN, data: 7, message: 'ok' },
  { code: Infinity, data: 7, message: 'ok' },
])('rejects malformed or legacy wire %j even on an HTTP failure', value => {
  for (const status of [200, 401]) {
    expect(readWireEnvelope(value, status)).toEqual({ ok: false, error: { kind: 'protocol', status } });
  }
});
