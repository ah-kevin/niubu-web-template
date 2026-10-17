import { expect, it } from 'vitest';
import { checkLocales } from './locale-check';
import { checkWorkspaceLocales, readAppLocaleBindings, readLocaleCatalogs } from './locale-check';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverFrontendApps } from './frontend-apps.ts';

it('reads a valid NoWeb primary catalog through the original locale parser', () => {
  const root = mkdtempSync(join(tmpdir(), 'niubu-locale-noweb-'));
  try {
    const put = (file: string, value: unknown) => {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(value));
    };
    put('package.json', { name: 'fixture', private: true });
    writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
    put('apps/primary/package.json', {
      name: '@fixture/primary',
      scripts: { build: 'node ../../internal/scripts/src/build-app.ts' },
      devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
    });
    for (const locale of ['zh-CN', 'en-US']) {
      put(`packages/locales/src/resources/${locale}/common.json`, { ok: 'OK' });
      put(`apps/primary/src/locales/${locale}/app.json`, { title: 'Primary {{name}}' });
    }
    const catalogs = readLocaleCatalogs(root);
    expect(catalogs.get('app/zh-CN/app')).toEqual({ title: 'Primary {{name}}' });
    expect(catalogs.get('app/en-US/app')).toEqual({ title: 'Primary {{name}}' });
    expect(checkLocales(catalogs).errors).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
const pair = (zh: Record<string, string>, en: Record<string, string>) =>
  new Map([
    ['public/zh-CN/common', zh],
    ['public/en-US/common', en],
  ]);
it('compares full keys per namespace', () => {
  expect(checkLocales(pair({ a: '中', b: '文' }, { a: 'English' })).errors.length).toBeGreaterThan(0);
});
it('compares interpolation parameter sets including repeated and reordered slots', () => {
  expect(checkLocales(pair({ a: '{{value}} {{unit}} {{value}}' }, { a: '{{unit}} {{value}}' })).errors).toEqual([]);
  expect(checkLocales(pair({ a: '{{value}} {{unit}}' }, { a: '{{value}} {{other}}' })).errors.length).toBeGreaterThan(
    0,
  );
});
it('does not confuse keys in different namespaces and rejects app overrides', () => {
  const map = pair({ a: '中' }, { a: 'English' });
  map.set('app/zh-CN/app', { a: '入口' });
  map.set('app/en-US/app', { a: 'Entry' });
  expect(checkLocales(map).errors).toEqual([]);
  map.set('app/en-US/common', { a: 'Override' });
  expect(checkLocales(map).errors.length).toBeGreaterThan(0);
});
it('rejects missing language pairs and malformed identities', () => {
  expect(checkLocales(new Map([['public/zh-CN/common', { a: '中' }]])).errors.length).toBeGreaterThan(0);
  expect(checkLocales(new Map([['common', { a: '中' }]])).errors.length).toBeGreaterThan(0);
});
it.each(['toString', 'constructor'])('reports an absent own %s translation on either language side', key => {
  const missingEnglish = checkLocales(pair({ [key]: '中文' }, {}));
  expect(missingEnglish.errors).toContain(`Key parity differs: public/common:${key}`);
  const missingChinese = checkLocales(pair({}, { [key]: 'English' }));
  expect(missingChinese.errors).toContain(`Key parity differs: public/common:${key}`);
});
it('accepts matching own toString and constructor translation keys', () => {
  expect(
    checkLocales(
      pair(
        { toString: '值 {{value}}', constructor: '构造' },
        { toString: 'Value {{value}}', constructor: 'Constructor' },
      ),
    ).errors,
  ).toEqual([]);
});

it('rejects missing app binding keys and interpolation arguments even when catalog pairs agree', () => {
  const catalogs = new Map([
    ['app/zh-CN/sales', { count: '{{count}} 项' }],
    ['app/en-US/sales', { count: '{{count}} items' }],
  ]);
  expect(
    checkLocales(catalogs, {
      bindings: [
        { namespace: 'sales', key: 'absent', parameters: [], location: 'sales/Card.tsx:2' },
        { namespace: 'sales', key: 'count', parameters: ['wrong'], location: 'sales/Card.tsx:3' },
      ],
    }).errors,
  ).toEqual([
    'Missing bound key: sales/Card.tsx:2 sales:absent',
    'Bound interpolation parameters differ: sales/Card.tsx:3 sales:count',
  ]);
  expect(
    checkLocales(catalogs, {
      bindings: [{ namespace: 'sales', key: 'count', parameters: ['count'], location: 'sales/Card.tsx:3' }],
    }).errors,
  ).toEqual([]);
});

function workspaceFixture(run: (root: string, put: (file: string, value: unknown) => void) => void, multiple = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-locale-workspace-')));
  const put = (file: string, value: unknown) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  try {
    put('package.json', { name: 'fixture' });
    put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
    for (const name of multiple ? ['primary', 'secondary'] : ['primary']) {
      put(`apps/${name}/package.json`, {
        name: `@fixture/${name}`,
        scripts: { build: 'node ../../internal/scripts/src/build-app.ts' },
        devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
      });
      for (const locale of ['zh-CN', 'en-US'])
        put(`apps/${name}/src/locales/${locale}/app.json`, { title: `${name} {{name}}` });
      put(`apps/${name}/src/app/Page.tsx`, "td('title', { name: 'fixture' });");
    }
    for (const locale of ['zh-CN', 'en-US']) put(`packages/locales/src/resources/${locale}/common.json`, { ok: 'OK' });
    run(root, put);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it('checks valid NoWeb catalogs and collects td bindings without a hardcoded overview file', () => {
  workspaceFixture(root => {
    expect(checkWorkspaceLocales(root).errors).toEqual([]);
    expect(readAppLocaleBindings(root)).toMatchObject([{ namespace: 'app', key: 'title', parameters: ['name'] }]);
    expect(() => checkWorkspaceLocales(root, { app: '@fixture/secondary' })).toThrow(/unknown.*frontend/i);
  });
});
it.each([
  ['key', {}, /Key parity differs/],
  ['interpolation', { title: '{{wrong}}' }, /Interpolation parameters differ/],
])('rejects a NoWeb primary %s defect', (_kind, catalog, error) => {
  workspaceFixture((root, put) => {
    put('apps/primary/src/locales/en-US/app.json', catalog);
    expect(checkWorkspaceLocales(root).errors.join('\n')).toMatch(error);
  });
});
it.each([
  ["td('absent')", /Missing bound key/],
  ["td('title', { wrong: 1 })", /Bound interpolation parameters differ/],
])('rejects a NoWeb td defect: %s', (source, error) => {
  workspaceFixture((root, put) => {
    put('apps/primary/src/app/Page.tsx', source);
    expect(checkWorkspaceLocales(root).errors.join('\n')).toMatch(error);
  });
});
it('validates each frontend namespace independently, including defects in either app', () => {
  workspaceFixture((root, put) => {
    for (const locale of ['zh-CN', 'en-US']) {
      put(`apps/secondary/src/locales/${locale}/app.json`, { secondary: 'Secondary' });
      put(`apps/primary/src/locales/${locale}/app.json`, { primary: 'Primary' });
    }
    put('apps/secondary/src/app/Page.tsx', "td('secondary')");
    put('apps/primary/src/app/Page.tsx', "td('primary')");
    expect(checkWorkspaceLocales(root).errors).toEqual([]);
    put('apps/primary/src/app/Page.tsx', "td('secondary')");
    expect(checkWorkspaceLocales(root).errors.join('\n')).toMatch(/@fixture\/primary.*Missing bound key/);
    expect(checkWorkspaceLocales(root, { app: '@fixture/secondary' }).errors).toEqual([]);
    put('apps/primary/src/app/Page.tsx', "td('primary')");
    put('apps/secondary/src/app/Page.tsx', "td('primary')");
    expect(checkWorkspaceLocales(root).errors.join('\n')).toMatch(/@fixture\/secondary.*Missing bound key/);
  }, true);
});
it('rejects a primary override of a public namespace', () => {
  workspaceFixture((root, put) => {
    for (const locale of ['zh-CN', 'en-US'])
      put(`apps/primary/src/locales/${locale}/common.json`, { ok: 'Override' });
    expect(checkWorkspaceLocales(root).errors.join('\n')).toMatch(/App cannot override public namespace/);
  });
});
it('retains domain namespace extraction and ignores test-only td calls', () => {
  workspaceFixture((root, put) => {
    for (const locale of ['zh-CN', 'en-US'])
      put(`apps/primary/src/locales/${locale}/sales.json`, { count: '{{count}}' });
    put('apps/primary/src/domains/sales/Card.tsx', "td('count', { count: 1 })");
    put('apps/primary/src/domains/sales/Card.test.tsx', "td('absent')");
    expect(checkWorkspaceLocales(root).errors).toEqual([]);
    expect(readAppLocaleBindings(root)).toHaveLength(2);
  });
});
// Read expected identities and bytes directly from source directories, independently
// of the locale checker and its catalog discovery implementation.
function sourceCatalogInventory(owner: string, directory: string): Map<string, Record<string, string>> {
  const catalogs = new Map<string, Record<string, string>>();
  const visit = (current: string, parts: string[]) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = join(current, entry.name);
      if (entry.isDirectory()) visit(file, [...parts, entry.name]);
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        const [locale, ...namespaceParts] = [...parts, entry.name.slice(0, -5)];
        expect(namespaceParts.length).toBeGreaterThan(0);
        const identity = [owner, locale, namespaceParts.join('.')].join('/');
        expect(catalogs.has(identity)).toBe(false);
        catalogs.set(identity, JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>);
      }
    }
  };
  visit(directory, []);
  return catalogs;
}
it('audits every actual frontend catalog and retains each app source binding contract', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const apps = discoverFrontendApps(root);
  expect(apps.length).toBeGreaterThan(0);
  const publicCatalogs = sourceCatalogInventory('public', join(root, 'packages/locales/src/resources'));
  expect([...publicCatalogs.keys()].sort()).toEqual([
    'public/en-US/common', 'public/en-US/shell', 'public/en-US/validation',
    'public/zh-CN/common', 'public/zh-CN/shell', 'public/zh-CN/validation',
  ]);
  for (const app of apps) {
    expect(JSON.parse(readFileSync(join(app.root, 'package.json'), 'utf8')).name).toBe(app.name);
    const appCatalogs = sourceCatalogInventory('app', join(app.root, 'src/locales'));
    expect(appCatalogs.size).toBeGreaterThan(0);
    const expected = new Map([...publicCatalogs, ...appCatalogs]);
    const catalogs = readLocaleCatalogs(root, { app: app.name });
    const bindings = readAppLocaleBindings(root, { app: app.name });
    expect([...catalogs.keys()].sort()).toEqual([...expected.keys()].sort());
    expect(catalogs.size).toBe(expected.size);
    for (const [identity, resource] of expected) expect(catalogs.get(identity)).toEqual(resource);
    expect(checkLocales(expected, { bindings }).errors).toEqual([]);
    expect(checkWorkspaceLocales(root, { app: app.name }).errors).toEqual([]);
  }
  expect(checkWorkspaceLocales(root).errors).toEqual([]);
});
