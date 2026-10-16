import { expect, it } from 'vitest';
import { resolvePlaygroundReturnTo } from '../../apps/playground/src/auth/return-to';
it('preserves registered return paths and scope/query data without creating a route',()=>{
  const value='/request?scopeKind=workspace&scopeId=north&value=a%20b';
  expect(resolvePlaygroundReturnTo(value)).toBe(value);
});
it.each(['https://elsewhere.invalid/request','//elsewhere.invalid/request','/login','/unknown','/request?scopeKind=workspace&scopeId=north&scopeId=south','/request?scopeKind=other&scopeId=north'])('rejects an unsafe, unknown, looping or malformed destination: %s',value=>{
  expect(resolvePlaygroundReturnTo(value)).toBe('/home');
});
