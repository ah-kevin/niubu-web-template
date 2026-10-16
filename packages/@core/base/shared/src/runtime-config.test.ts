import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  RuntimeConfigError,
  parseRuntimeConfigScript,
  resolveRuntimeConfig,
  serializeRuntimeConfig,
  validateRuntimeConfig,
} from './runtime-config';
import type { RuntimeConfig, RuntimeConfigDescriptor } from './runtime-config';

const config = (apiURL: unknown = '/') => ({ schemaVersion: 1, apiURL });
const script = (json: string) => `globalThis.__APP_RUNTIME_CONFIG__=${json};\n`;

function diagnostic(run: () => unknown, field: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuntimeConfigError);
  expect(caught).toMatchObject({ field, code: expect.any(String), reason: expect.any(String) });
  return caught as RuntimeConfigError;
}

describe('runtime configuration validation', () => {
  it('accepts plain data produced in the build verifier sandbox', () => {
    const value: unknown = runInNewContext('({ schemaVersion: 1, apiURL: "https://api.example.test/" })');
    expect(validateRuntimeConfig(value)).toEqual({ schemaVersion: 1, apiURL: 'https://api.example.test/' });
    expect(resolveRuntimeConfig(value, 'https://shell.example.test')).toEqual({
      apiBaseURL: 'https://api.example.test/',
    });
  });

  it.each(['/', 'https://api.example.test', 'http://localhost:8080/', 'https://[::1]:8443/'])(
    'accepts root API address %s without rewriting source data',
    apiURL => {
      expect(validateRuntimeConfig(config(apiURL))).toEqual({ schemaVersion: 1, apiURL });
    },
  );

  it.each([undefined, null, [], true, 1, 'config', new Date(), Object.create({ schemaVersion: 1, apiURL: '/' })])(
    'rejects missing or non-record config %#',
    value => {
      diagnostic(() => validateRuntimeConfig(value), 'config');
    },
  );

  it.each([undefined, null, '1', 0, 2, NaN])('rejects schema version %#', schemaVersion => {
    diagnostic(() => validateRuntimeConfig({ schemaVersion, apiURL: '/' }), 'schemaVersion');
  });

  it.each([
    'appId',
    'storageNamespace',
    'environment',
    'identity',
    'accessMode',
    'tokens',
    'auth',
    'session',
    '__proto__',
    'constructor',
    'prototype',
  ])('rejects forbidden field %s without broadening public config', key => {
    diagnostic(() => validateRuntimeConfig({ ...config(), [key]: 'synthetic-private-value' }), 'config');
  });

  it('rejects symbols and hidden fields instead of silently dropping them', () => {
    diagnostic(() => validateRuntimeConfig({ ...config(), [Symbol('extra')]: true }), 'config');
    diagnostic(() => validateRuntimeConfig(Object.defineProperty(config(), 'extra', { value: true })), 'config');
  });

  it('rejects accessors without executing config code', () => {
    let reads = 0;
    const value = {
      schemaVersion: 1,
      get apiURL() {
        reads++;
        return '/';
      },
    };
    diagnostic(() => validateRuntimeConfig(value), 'apiURL');
    expect(reads).toBe(0);
  });

  it.each([
    undefined,
    null,
    [],
    {},
    1,
    '',
    '//api.example.test',
    '/api',
    'api.example.test',
    'ftp://api.example.test',
    'javascript:alert(1)',
    'https:api.example.test',
    'https:///api.example.test',
    'https://api.example.test/api',
    'https://api.example.test//',
    'https://api.example.test/.',
    'https://api.example.test/a/..',
    'https://api.example.test/%2e',
    'https://user:synthetic-private-value@api.example.test',
    'https://user@api.example.test',
    'https://@api.example.test',
    'https://api.example.test?key=synthetic-private-value',
    'https://api.example.test?',
    'https://api.example.test/#fragment',
    'https://api.example.test#',
    'https://api.example.test\\',
    'https://api.example.test\n',
    ' https://api.example.test',
    'https://api.example.test/\t',
    'https://api.example.test\u007f',
    'https://api.example.test\u0085',
    'https://api.example.test:99999',
    'https://',
  ])('rejects unsafe or non-root API address %#', apiURL => {
    diagnostic(() => validateRuntimeConfig({ schemaVersion: 1, apiURL }), 'apiURL');
  });

  it('returns detached immutable data and accepts frozen source defaults', () => {
    const source = config();
    const validated = validateRuntimeConfig(source);
    source.apiURL = 'https://changed.example.test';
    expect(validated).toEqual({ schemaVersion: 1, apiURL: '/' });
    expect(Object.isFrozen(validated)).toBe(true);
    expect(validateRuntimeConfig(Object.freeze(config()))).toEqual({ schemaVersion: 1, apiURL: '/' });
  });
});

describe('canonical runtime configuration script', () => {
  it('serializes fixed key order and parses its exact bytes', () => {
    const value: RuntimeConfig = { apiURL: 'https://api.example.test:8443/', schemaVersion: 1 };
    const expected =
      'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"https://api.example.test:8443/"};\n';
    expect(serializeRuntimeConfig(value)).toBe(expected);
    expect(parseRuntimeConfigScript(expected)).toEqual(value);
  });

  it('validates serializer inputs even when type checking was bypassed', () => {
    diagnostic(
      () => serializeRuntimeConfig({ ...config(), auth: 'synthetic-private-value' } as RuntimeConfig),
      'config',
    );
  });

  it.each([
    '',
    '{}',
    'window.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"/"};\n',
    script('{'),
    script('null'),
    script('[]'),
    script('{"schemaVersion":1,"apiURL":"/","__proto__":{}}'),
    script('{"schemaVersion":1,"apiURL":"/","apiURL":"/"}'),
    script('{"apiURL":"/","schemaVersion":1}'),
    script('{ "schemaVersion":1,"apiURL":"/"}'),
    script('{"schemaVersion":1,"apiURL":"\\u002f"}'),
    script('{"schemaVersion":1.0,"apiURL":"/"}'),
    '\ufeff' + script('{"schemaVersion":1,"apiURL":"/"}'),
    script('{"schemaVersion":1,"apiURL":"/"}').replace(';\n', ';\r\n'),
    script('{"schemaVersion":1,"apiURL":"/"}').trimEnd(),
    script('{"schemaVersion":1,"apiURL":"/"}') + 'globalThis.injected=true;',
    'globalThis.__APP_RUNTIME_CONFIG__=(()=>{throw Error("synthetic-private-value")})();\n',
  ])('rejects noncanonical or executable script %#', source => {
    expect(() => parseRuntimeConfigScript(source)).toThrow(RuntimeConfigError);
  });

  it('does not publish or execute script contents during parsing', () => {
    const key = '__APP_RUNTIME_CONFIG__';
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    expect(parseRuntimeConfigScript(script('{"schemaVersion":1,"apiURL":"/"}'))).toEqual(config());
    expect(Object.getOwnPropertyDescriptor(globalThis, key)).toEqual(before);
  });

  it('does not include supplied values or native parser errors in diagnostics', () => {
    for (const run of [
      () => validateRuntimeConfig(config('https://user:synthetic-private-value@api.example.test')),
      () => validateRuntimeConfig({ ...config(), 'synthetic-private-value': true }),
      () => parseRuntimeConfigScript(script('synthetic-private-value')),
    ]) {
      expect(run).toThrow(RuntimeConfigError);
      try {
        run();
      } catch (error) {
        expect(String(error)).not.toContain('synthetic-private-value');
        expect(JSON.stringify(error)).not.toContain('synthetic-private-value');
        expect(error).not.toHaveProperty('cause');
      }
    }
  });
});

describe('runtime API resolution', () => {
  it('resolves relative root using the explicitly supplied origin', () => {
    expect(resolveRuntimeConfig(config(), 'https://shell.example.test:8443')).toEqual({
      apiBaseURL: 'https://shell.example.test:8443/',
    });
    expect(resolveRuntimeConfig(config('http://api.example.test:8080'), 'https://shell.example.test')).toEqual({
      apiBaseURL: 'http://api.example.test:8080/',
    });
  });

  it.each([
    'null',
    '',
    '/relative',
    'file:///tmp',
    'https://user:synthetic-private-value@host.test',
    'https://host.test/path',
    'https://host.test?',
    'https://host.test#',
  ])('rejects invalid origin %#', origin => {
    diagnostic(() => resolveRuntimeConfig(config(), origin), 'origin');
  });

  it('never substitutes defaults for missing or invalid script data', () => {
    diagnostic(() => resolveRuntimeConfig(undefined, 'https://shell.example.test'), 'config');
    diagnostic(() => resolveRuntimeConfig(config('/api'), 'https://shell.example.test'), 'apiURL');
  });

  it('keeps source descriptors independent without mutating defaults', () => {
    const a: RuntimeConfigDescriptor = Object.freeze({
      fileName: '_app.config.js',
      schemaVersion: 1,
      defaults: Object.freeze({ schemaVersion: 1, apiURL: '/' }),
    });
    const b: RuntimeConfigDescriptor = Object.freeze({
      fileName: '_app.config.js',
      schemaVersion: 1,
      defaults: Object.freeze({ schemaVersion: 1, apiURL: 'https://api-b.example.test/' }),
    });
    expect(resolveRuntimeConfig(a.defaults, 'https://app-a.example.test')).toEqual({
      apiBaseURL: 'https://app-a.example.test/',
    });
    expect(resolveRuntimeConfig(b.defaults, 'https://app-b.example.test')).toEqual({
      apiBaseURL: 'https://api-b.example.test/',
    });
    expect(a.defaults).toEqual({ schemaVersion: 1, apiURL: '/' });
    expect(b.defaults).toEqual({ schemaVersion: 1, apiURL: 'https://api-b.example.test/' });
  });
});
