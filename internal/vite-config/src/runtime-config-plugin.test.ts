import { expect, it } from 'vitest';
import type { ViteDevServer, ResolvedConfig } from 'vite';
import { runtimeConfigPlugin } from './runtime-config-plugin.ts';
import { assertRuntimeConfigHead, type RuntimeConfigDescriptor } from '@niubu-internal/node-utils';
import { createWebViteConfig } from './index.ts';

it('registers the source-declared runtime generator after theme initialization', () => {
  const config = createWebViteConfig({
    appRoot: process.cwd(),
    workspaceRoot: process.cwd(),
    runtimeConfig: { fileName: '_app.config.js', schemaVersion: 1, defaults: { schemaVersion: 1, apiURL: '/' } },
    themeInit: { entry: 'src/theme.js', appId: 'fixture', environment: 'test', globalName: 'FixtureTheme' },
  });
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string')
      names.push(value.name);
  };
  visit(config.plugins);
  expect(names).toContain('niubu:runtime-config');
  expect(names.indexOf('niubu:runtime-config')).toBeGreaterThan(names.indexOf('niubu:theme-init'));
});

const descriptor: RuntimeConfigDescriptor = {
  fileName: '_app.config.js',
  schemaVersion: 1,
  defaults: { schemaVersion: 1, apiURL: '/' },
};
it('serves only its exact effective-base path as a no-store canonical script without a socket', () => {
  const plugin = runtimeConfigPlugin(descriptor);
  if (typeof plugin.configResolved !== 'function' || typeof plugin.configureServer !== 'function')
    throw Error('Missing dev hooks');
  (plugin.configResolved as (config: ResolvedConfig) => void)({ base: '/portal/', command: 'serve' } as ResolvedConfig);
  type Middleware = (
    request: { url?: string },
    response: { setHeader(name: string, value: string): void; end(body: string): void },
    next: () => void,
  ) => void;
  let middleware: Middleware | undefined;
  (plugin.configureServer as (server: ViteDevServer) => void)({
    middlewares: {
      use(handler: Middleware) {
        middleware = handler;
      },
    },
  } as unknown as ViteDevServer);
  const headers: Record<string, string> = {},
    bodies: string[] = [];
  let next = 0;
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(body: string) {
      bodies.push(body);
    },
  };
  middleware!({ url: '/portal/_app.config.js?cache=1' }, res, () => next++);
  expect(headers).toEqual({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
  expect(bodies).toEqual(['globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"/"};\n']);
  for (const url of ['/_app.config.js', '/portal/other.js', '/portal/_app.config.js/extra', undefined])
    middleware!({ url }, res, () => next++);
  expect(next).toBe(4);
  expect(bodies).toHaveLength(1);
});
it.each([
  { fileName: 'other.js' },
  { schemaVersion: 2 },
  { globalName: 'Other' },
  { parser: () => ({}) },
  { defaults: { schemaVersion: 1, apiURL: 'https://host.example/path' } },
])('rejects altered source descriptor policy %j', change => {
  expect(() => runtimeConfigPlugin({ ...descriptor, ...change } as RuntimeConfigDescriptor)).toThrow();
});
it('snapshots defaults before a caller can mutate the descriptor', () => {
  const mutable = { ...descriptor, defaults: { ...descriptor.defaults } };
  const plugin = runtimeConfigPlugin(mutable);
  mutable.defaults.apiURL = 'https://later.example';
  if (typeof plugin.configResolved !== 'function' || typeof plugin.configureServer !== 'function')
    throw Error('Missing dev hooks');
  (plugin.configResolved as (config: ResolvedConfig) => void)({ base: '/', command: 'serve' } as ResolvedConfig);
  let source = '';
  (plugin.configureServer as (server: ViteDevServer) => void)({
    middlewares: {
      use(
        handler: (req: { url: string }, res: { setHeader(): void; end(text: string): void }, next: () => void) => void,
      ) {
        handler(
          { url: '/_app.config.js' },
          {
            setHeader() {},
            end(text) {
              source = text;
            },
          },
          () => {},
        );
      },
    },
  } as unknown as ViteDevServer);
  expect(source).toBe('globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"/"};\n');
});
it.each([
  '<script src="/theme.js"></script><script defer src="/_app.config.js"></script>',
  '<script src="/theme.js"></script><script async src="/_app.config.js"></script>',
  '<script src="/theme.js"></script><script type="text/javascript" src="/_app.config.js"></script>',
  '<script src="/theme.js"></script><script src="/_app.config.js"></script><script src="/_app.config.js"></script>',
  '<script src="/_app.config.js"></script><script src="/theme.js"></script>',
  '<script src="/theme.js"></script><link rel="stylesheet" href="/app.css"><script src="/_app.config.js"></script>',
  '<script src="/theme.js"></script><script src="/_app.config.js" src="/other.js"></script>',
  '<script src="/theme.js"></script><!--<script src="/_app.config.js"></script>-->',
])('rejects invalid blocking script order/uniqueness before roots deduplication', tags => {
  expect(() =>
    assertRuntimeConfigHead('<html><head>' + tags + '</head></html>', '/_app.config.js', '/theme.js'),
  ).toThrow();
});

it.each(['nomodule','NoMoDuLe="false"'])('rejects a config script skipped by module-capable browsers: %s',attribute=>{
 const html='<html><head><script src="/theme.js"></script><script '+attribute+' src="/_app.config.js"></script><script type="module" src="/app.js"></script></head></html>';
 expect(()=>assertRuntimeConfigHead(html,'/_app.config.js','/theme.js')).toThrow(/blocking classic script/);
});
