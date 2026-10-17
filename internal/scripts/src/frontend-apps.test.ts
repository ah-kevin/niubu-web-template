import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { discoverFrontendApps, selectFrontendApp } from './frontend-apps';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture(names = ['@fixture/primary', '@fixture/secondary']) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-frontends-')));
  roots.push(root);
  const put = (file: string, value: unknown) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  put('package.json', { name: 'fixture' });
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
  for (const name of names) {
    put(`apps/${name.split('/')[1]}/package.json`, {
      name,
      scripts: { build: 'node ../../internal/scripts/src/build-app.ts' },
      devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
    });
  }
  put('apps/backend-mock/package.json', { name: '@niubu/backend-mock', scripts: { build: 'nitro build' } });
  // A shared package with Vite tooling is still not a frontend app.
  put('packages/shared/package.json', {
    name: '@niubu/shared',
    scripts: { build: 'vite build' },
    devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
  });
  return { root, put };
}

it('discovers both fixture frontend apps from workspace metadata and excludes backend packages', () => {
  const { root } = fixture();
  expect(discoverFrontendApps(root)).toEqual([
    { name: '@fixture/primary', root: join(root, 'apps/primary') },
    { name: '@fixture/secondary', root: join(root, 'apps/secondary') },
  ]);
});
it('rejects multiple frontends regardless of package name and supports explicit selection', () => {
  const { root } = fixture();
  expect(() => selectFrontendApp(root)).toThrow(/ambiguous/i);
  expect(selectFrontendApp(root, '@fixture/primary').name).toBe('@fixture/primary');

});
it('selects the sole primary and refuses an explicitly missing frontend', () => {
  const { root } = fixture(['@fixture/primary']);
  expect(selectFrontendApp(root)).toEqual({ name: '@fixture/primary', root: join(root, 'apps/primary') });
  expect(() => selectFrontendApp(root, '@fixture/secondary')).toThrow(/unknown.*frontend/i);
  expect(() => selectFrontendApp(root, '@niubu/backend-mock')).toThrow(/unknown.*frontend/i);
});
it('rejects ambiguous defaults and zero frontend apps', () => {
  const { root } = fixture(['@fixture/one', '@fixture/two']);
  expect(() => selectFrontendApp(root)).toThrow(/ambiguous/i);
  expect(selectFrontendApp(root, '@fixture/two').name).toBe('@fixture/two');
  expect(() => discoverFrontendApps(fixture([]).root)).toThrow(/no frontend/i);
});
it('honors actual workspace globs instead of discovering an excluded directory', () => {
  const { root, put } = fixture();
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - '!apps/secondary'\n");
  expect(discoverFrontendApps(root).map(app => app.name)).toEqual(['@fixture/primary']);
});
