import { expect, it } from 'vitest';
import { ACCESS_EXPIRED_CODE, isAccessExpired } from './protocol';

it('recognizes only an explicit unauthorized access-expired response', () => {
  expect(isAccessExpired({ kind: 'http', status: 401, code: ACCESS_EXPIRED_CODE })).toBe(true);
  expect(isAccessExpired({ kind: 'http', status: 401, code: 'UNAUTHORIZED' })).toBe(false);
  expect(isAccessExpired({ kind: 'http', status: 403, code: ACCESS_EXPIRED_CODE })).toBe(false);
  expect(isAccessExpired({ kind: 'protocol', status: 401, code: ACCESS_EXPIRED_CODE })).toBe(false);
});
