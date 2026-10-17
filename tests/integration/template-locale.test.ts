// @vitest-environment node
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { discoverFrontendApps } from '../../internal/scripts/src/frontend-apps';
import { readAppLocaleBindings, readLocaleCatalogs, checkWorkspaceLocales } from '../../internal/scripts/src/locale-check';
it('retains the explicit template locale baseline independently of portable tooling fixtures', () => {
  const root = resolve(import.meta.dirname, '../..');
  expect(discoverFrontendApps(root).map(app => app.name)).toEqual(['@niubu/playground']);
  const catalogs = readLocaleCatalogs(root, { app: '@niubu/playground' });
  expect([...catalogs.keys()].sort()).toEqual(['en-US', 'zh-CN'].flatMap(locale => [
    `app/${locale}/app`, ...['common', 'shell', 'validation'].map(namespace => `public/${locale}/${namespace}`),
  ]).sort());
  expect(catalogs.size).toBe(8);
  expect(readAppLocaleBindings(root, { app: '@niubu/playground' })).toHaveLength(0);
  expect(checkWorkspaceLocales(root, { app: '@niubu/playground' }).errors).toEqual([]);
  expect(checkWorkspaceLocales(root).errors).toEqual([]);
});
