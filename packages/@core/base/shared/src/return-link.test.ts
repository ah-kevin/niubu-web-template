import { describe, expect, it } from 'vitest';
import { createReturnPathResolver } from '@niubu/core-shared';

describe('scoped return path resolvers', () => {
  const resolve = () => createReturnPathResolver(path => path === '/list' || path === '/detail/id.A-01_~', '/home');
  it.each(['//outside.test', '/\\evil.test', '/%5cevil.test', 'https://evil.test', '/detail/%69d', '/list/../list', '/list?x=%ZZ', '/list\n', '/unknown'])('rejects %s without changing URL identity', raw => {
    expect(resolve()(raw, '/list')).toBe('/list');
  });
  it('retains exact query and fragment state and validates the fallback', () => {
    expect(resolve()('/detail/id.A-01_~?returnTo=%2Flist#history', '/list')).toBe('/detail/id.A-01_~?returnTo=%2Flist#history');
    expect(resolve()(null, '/unknown')).toBe('/home');
    expect(resolve()('/unknown', 'https://outside.test')).toBe('/home');
  });
  it('keeps separate policies and defaults without shared mutation', () => {
    const a = createReturnPathResolver(path => path === '/a', '/a-home');
    const b = createReturnPathResolver(path => path === '/b', '/b-home');
    expect(a('/a?tab=x', '/b')).toBe('/a?tab=x');
    expect(b('/a', '/b')).toBe('/b');
    expect(a('/b', '/b')).toBe('/a-home');
    expect(b(null, '/a')).toBe('/b-home');
  });
});
