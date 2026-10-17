import { expect, it } from 'vitest';
import * as backend from './backend-process.ts';
function parse(args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const candidate = (backend as unknown as Record<string, unknown>).parseBackendMockOptions;
  expect(candidate, 'standalone CLI supports validated explicit options').toBeTypeOf('function');
  return (candidate as (args: readonly string[], env: NodeJS.ProcessEnv) => {host: string; port: number})(args, env);
}
it('defaults to loopback and port 5320 without depending on an app', () => {
  expect(parse([])).toEqual({ host: '127.0.0.1', port: 5320 });
});
it('uses explicit CLI options ahead of environment without mutating it', () => {
  const env = { MOCK_HOST: 'localhost', MOCK_PORT: '5440' };
  expect(parse(['--host', '127.0.0.1', '--port', '5432'], env)).toEqual({host: '127.0.0.1', port: 5432});
  expect(env).toEqual({ MOCK_HOST: 'localhost', MOCK_PORT: '5440' });
  expect(parse([], env)).toEqual({host: 'localhost', port: 5440});
});
it.each([['--port','0'],['--port','65536'],['--port','12e3'],['--port','1.5'],['--port'],['--port','5320','--port','5321'],['--unknown','1'],['--host','http://127.0.0.1'],['--host','local host']])('rejects invalid startup options %j', (...args) => {
  // Assert the interface first so the absent implementation is an explicit RED.
  expect(() => parse(args)).toThrow(/Invalid mock/);
});

it('rejects DNS hosts unsupported by the actual Nitro listener instead of widening the bind', () => {
  expect(() => parse(['--host', 'mock-service.' + 'a'.repeat(50) + '.example.test'])).toThrow(/Invalid mock host/);
});
