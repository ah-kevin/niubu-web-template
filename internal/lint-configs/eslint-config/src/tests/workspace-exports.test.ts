import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ESLint } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { readWorkspace, resolveWorkspaceImport } from '@niubu-internal/node-utils';
import { createEslintConfig } from '../index';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-workspace-')));
const put = (path: string, content = 'export {};') => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};
put('package.json', JSON.stringify({ name: 'fixture', private: true }));
put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n  - 'internal/*'\n");
for (const [path, name, exports, dependencies] of [
  [
    'apps/playground',
    '@niubu/playground',
    {},
    { '@niubu/core': 'workspace:*', '@niubu/types': 'workspace:*', '@niubu/common-ui': 'workspace:*' },
  ],
  [
    'packages/core',
    '@niubu/core',
    { '.': './src/index.ts' },
    { '@niubu/types': 'workspace:*', '@niubu/shadcn-ui': 'workspace:*', react: '19.3.0' },
  ],
  ['packages/types', '@niubu/types', { '.': './src/index.ts' }, {}],
  [
    'packages/common-ui',
    '@niubu/common-ui',
    { '.': './src/index.ts' },
    { '@niubu/shadcn-ui': 'workspace:*', '@niubu/types': 'workspace:*' },
  ],
  [
    'packages/shadcn-ui',
    '@niubu/shadcn-ui',
    {
      './*': './src/*.ts',
      './private/*': null,
      './public/*': './src/approved/*.ts',
      './button': { types: './src/button.ts', default: './src/button.ts' },
      './icons/*': './src/icons/*.ts',
    },
    {},
  ],
  ['internal/tool', '@niubu/tool', { '.': './src/index.ts' }, {}],
] as const) {
  put(`${path}/package.json`, JSON.stringify({ name, private: true, exports, dependencies }));
  put(`${path}/src/index.ts`);
}
for (const file of [
  'src/main.ts',
  'apps/playground/src/main.ts',
  'apps/playground/src/domains/orders/pages/Page.tsx',
  'apps/playground/src/domains/orders/read.ts',
  'apps/playground/src/domains/orders/data/static-reader.ts',
  'apps/playground/src/domains/billing/read.ts',
  'apps/playground/src/domains/orders/module.ts',
  'apps/playground/src/domains/orders/index.ts',
  'apps/playground/src/domains/loose.ts',
  'apps/playground/src/router/modules.ts',
  'apps/playground/src/static-data/domains/orders.ts',
  'apps/playground/src/workflows/profile.ts',
  'packages/shadcn-ui/src/button.ts',
  'packages/shadcn-ui/src/private.ts',
  'packages/shadcn-ui/src/icons/star.ts',
  'packages/shadcn-ui/src/private/secret.ts',
  'packages/shadcn-ui/src/public/visible.ts',
  'packages/shadcn-ui/src/approved/visible.ts',
])
  put(file);
symlinkSync(join(root, 'apps/playground/src/main.ts'), join(root, 'packages/core/src/app-link.ts'));
const graph = readWorkspace(root);
const commonFile = join(root, 'packages/common-ui/src/index.ts');
const coreFile = join(root, 'packages/core/src/index.ts');
const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: createEslintConfig({ root }) });
async function boundaryErrors(file: string, source: string) {
  return (await eslint.lintText(source, { filePath: file }))
    .flatMap(result => result.messages)
    .filter(message => message.ruleId === 'architecture/import-boundaries');
}
afterAll(() => rmSync(root, { recursive: true, force: true }));
describe('workspace public entry resolution and enforced boundaries', () => {
  it('treats only existing domain directories as public read entries', async () => {
    const playgroundWorkflowFile = join(root, 'apps/playground/src/workflows/profile.ts');
    expect(await boundaryErrors(playgroundWorkflowFile, "import '../domains/orders/read';")).toEqual([]);
    expect(await boundaryErrors(playgroundWorkflowFile, "import '../domains/typo/read';")).not.toEqual([]);
    expect(await boundaryErrors(playgroundWorkflowFile, "import '../domains/loose';")).not.toEqual([]);
    expect(await boundaryErrors(playgroundWorkflowFile, "import '../domains/orders';")).toEqual([]);
    expect(await boundaryErrors(playgroundWorkflowFile, "import '../domains/orders/index';")).toEqual([]);
  });
  it('allows module declarations from discovered domains only in the route composer', async () => {
    expect(
      await boundaryErrors(join(root, 'apps/playground/src/router/modules.ts'), "import '../domains/orders/module';"),
    ).toEqual([]);
    expect(
      await boundaryErrors(join(root, 'apps/playground/src/workflows/profile.ts'), "import '../domains/orders/module';"),
    ).not.toEqual([]);
  });
  it('enforces declared dependencies on actual root source after package globs activate', async () => {
    expect(await boundaryErrors(join(root, 'src/main.ts'), "import 'undeclared-library';")).not.toHaveLength(0);
  });
  it('reads workspace manifests, declared dependencies and source roots', () => {
    expect([...graph.packages.keys()].sort()).toEqual([
      '@niubu/common-ui',
      '@niubu/core',
      '@niubu/playground',
      '@niubu/shadcn-ui',
      '@niubu/tool',
      '@niubu/types',
      'fixture',
    ]);
    expect(graph.packages.get('@niubu/common-ui')?.dependencies.has('@niubu/shadcn-ui')).toBe(true);
    expect(graph.packages.get('@niubu/core')?.sourceRoots).toEqual([join(root, 'packages/core/src')]);
  });
  it('resolves conditional and wildcard exports as real public files', () => {
    expect(resolveWorkspaceImport(graph, commonFile, '@niubu/shadcn-ui/button')).toEqual({
      kind: 'workspace',
      owner: '@niubu/shadcn-ui',
      file: join(root, 'packages/shadcn-ui/src/button.ts'),
      isPublic: true,
    });
    expect(resolveWorkspaceImport(graph, commonFile, '@niubu/shadcn-ui/icons/star')).toMatchObject({
      kind: 'workspace',
      isPublic: true,
    });
    expect(resolveWorkspaceImport(graph, commonFile, '@niubu/shadcn-ui/src/private')).toMatchObject({
      kind: 'workspace',
      isPublic: false,
    });
    expect(resolveWorkspaceImport(graph, commonFile, '../../shadcn-ui/src/button')).toMatchObject({
      kind: 'workspace',
      isPublic: false,
    });
    expect(resolveWorkspaceImport(graph, coreFile, './app-link')).toMatchObject({
      kind: 'workspace',
      owner: '@niubu/playground',
      isPublic: false,
    });
    expect(resolveWorkspaceImport(graph, coreFile, '@niubu/core/missing')).toMatchObject({ kind: 'unresolved' });
    expect(resolveWorkspaceImport(graph, commonFile, '@niubu/shadcn-ui/icons/../private')).toMatchObject({
      kind: 'unresolved',
    });
    expect(resolveWorkspaceImport(graph, coreFile, './missing')).toMatchObject({ kind: 'unresolved' });
    expect(resolveWorkspaceImport(graph, coreFile, 'react/jsx-runtime')).toEqual({ kind: 'external', name: 'react' });
  });
  it('honors a more specific null exclusion after a broad wildcard export', () => {
    expect(resolveWorkspaceImport(graph, commonFile, '@niubu/shadcn-ui/private/secret')).toMatchObject({
      kind: 'unresolved',
    });
  });
  it('enforces the specific null exclusion through actual ESLint', async () => {
    expect(await boundaryErrors(commonFile, "import '@niubu/shadcn-ui/private/secret';")).not.toHaveLength(0);
  });
  it('selects the more specific public target after the broad wildcard', () => {
    expect(resolveWorkspaceImport(graph, commonFile, '@niubu/shadcn-ui/public/visible')).toEqual({
      kind: 'workspace',
      owner: '@niubu/shadcn-ui',
      file: join(root, 'packages/shadcn-ui/src/approved/visible.ts'),
      isPublic: true,
    });
  });
  it('allows the selected specific public export through actual ESLint', async () => {
    expect(await boundaryErrors(commonFile, "import '@niubu/shadcn-ui/public/visible';")).toEqual([]);
  });
  it.each([
    ['packages/common-ui/src/index.ts', "import '@niubu/shadcn-ui/src/button';"],
    ['packages/common-ui/src/index.ts', "import '../../shadcn-ui/src/button';"],
    ['packages/core/src/index.ts', "import '../../../apps/playground/src/main';"],
    ['packages/core/src/index.ts', "import './app-link';"],
    ['packages/core/src/index.ts', "import '@niubu/shadcn-ui/button';"],
    ['packages/core/src/index.ts', "import '@niubu/common-ui';"],
    ['packages/common-ui/src/index.ts', "import '@niubu/tool';"],
    ['packages/common-ui/src/index.ts', "import 'undeclared-library';"],
    ['packages/common-ui/src/index.ts', "import '@niubu/shadcn-ui/icons/../private';"],
    ['packages/core/src/index.tsx', 'export const x = <div/>;'],
    ['packages/core/src/index.ts', "export type Node = import('react').ReactNode;"],
    ['apps/playground/src/domains/orders/pages/Page.tsx', "import '@/domains/orders/read';"],
    ['apps/playground/src/domains/orders/read.ts', "import type { ReactNode } from 'react';"],
    ['apps/playground/src/domains/orders/read.tsx', 'export const x = <div/>;'],
    ['apps/playground/src/domains/orders/pages/Page.tsx', "const path = '@/domains/orders/read'; void import(path);"],
    ['apps/playground/src/domains/orders/pages/Page.tsx', 'require(path);'],
    ['apps/playground/src/domains/orders/pages/Page.tsx', "require('@/static-data/domains/orders');"],
    ['apps/playground/src/domains/orders/pages/Page.tsx', "export * from '@/domains/billing/read';"],
  ])('rejects forbidden workspace dependency from %s', async (file, source) => {
    expect(await boundaryErrors(join(root, file), source)).not.toHaveLength(0);
  });
  it.each([
    ['packages/common-ui/src/index.ts', "import '@niubu/shadcn-ui/button'; import '@niubu/types';"],
    ['packages/core/src/index.ts', "import '@niubu/types';"],
    ['internal/tool/src/index.ts', "import './index';"],
    ['apps/playground/src/domains/orders/data/static-reader.ts', "import '@/static-data/domains/orders';"],
    ['apps/playground/src/workflows/profile.ts', "import '@/domains/orders/read'; import '@/domains/billing/read';"],
    ['apps/playground/src/domains/orders/pages/Page.tsx', "import type { Order } from '@/domains/orders/read';"],
  ])('allows declared public and sanctioned app dependencies from %s', async (file, source) => {
    expect(await boundaryErrors(join(root, file), source)).toEqual([]);
  });
});
