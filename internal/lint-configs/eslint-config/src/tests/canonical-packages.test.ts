import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, expect, it } from 'vitest';
import { createEslintConfig } from '../index';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-canonical-')));
const put = (file: string, value: string) => {
  mkdirSync(join(root, file, '..'), { recursive: true });
  writeFileSync(join(root, file), value);
};
put('package.json', JSON.stringify({ name: 'fixture', private: true }));
put('pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - packages/@core/base/*\n  - packages/@core/ui-kit/*\n  - packages/@core/*\n  - packages/effects/*\n');
const paths = ['@core/base/typings', '@core/base/shared', '@core/base/design', '@core/preferences', 'types', 'utils', '@core/ui-kit/shadcn-ui', '@core/ui-kit/layout-ui', '@core/ui-kit/menu-ui', 'effects/common-ui', 'effects/layouts', 'effects/plugins', 'icons'];
for (const path of paths) {
  const name = path.split('/').at(-1)!;
  const pkgName = path.startsWith('@core/base/') || path === '@core/preferences' ? `core-${name}` : name;
  put(`packages/${path}/package.json`, JSON.stringify({ name: `@niubu/${pkgName}`, private: true, exports: { '.': './src/index.ts', './button': './src/index.ts', './chart': './src/chart/index.ts', './csv': './src/csv/index.ts' }, dependencies: { react: '19.3.0', '@niubu/shadcn-ui': 'workspace:*', '@niubu/common-ui': 'workspace:*', '@niubu/plugins': 'workspace:*', '@niubu/icons': 'workspace:*' } }));
  put(`packages/${path}/src/index.ts`, 'export const implemented = true;');
  if (path === 'effects/plugins') {
    put(`packages/${path}/src/chart/index.ts`, 'export const chart = true;');
    put(`packages/${path}/src/csv/index.ts`, 'export const parse = true;');
  }
}
const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: createEslintConfig({ root }) });
async function errors(path: string, text: string) {
  return (await eslint.lintText(text, { filePath: join(root, `packages/${path}/src/index.tsx`) }))
    .flatMap(result => result.messages).filter(message => message.ruleId === 'architecture/import-boundaries');
}
afterAll(() => rmSync(root, { recursive: true, force: true }));
it.each(paths.slice(0, 6))('enforces pure canonical %s despite explicitly declared React and UI dependencies', async path => {
  for (const text of ["import 'react';", "export type Node = import('react').ReactNode;", "import '@niubu/shadcn-ui/button';", "import '@niubu/common-ui';", "import '@niubu/plugins/chart';", "import '@niubu/icons';", 'export const node = <div />;']) {
    expect(await errors(path, text), text).not.toHaveLength(0);
  }
});
it.each(paths.slice(6))('permits controlled canonical presentation %s to use React', async path => {
  expect(await errors(path, "import { createElement } from 'react'; export const node = createElement('div');")).toEqual([]);
});
