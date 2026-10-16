import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkWorkspace } from './workspace-check.ts';

const roots: string[] = [];
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-check-')));
  roots.push(root);
  const put = (path: string, value: string) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  put('package.json', JSON.stringify({ name: 'command-center', private: true }));
  put('pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - apps/*\n  - internal/*\n');
  const pkg = (path: string, name: string, extra = {}) => {
    put(path + '/package.json', JSON.stringify({ name, private: true, exports: { '.': './src/index.ts' }, ...extra }));
    put(path + '/src/index.ts', 'export const implemented = 1;');
  };
  return { root, put, pkg };
}
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
describe('workspace acceptance uses actual manifests, files and test ownership', () => {
  it('accepts an implemented DAG and JSON configuration source exports', () => {
    const { root, put, pkg } = fixture();
    pkg('packages/base', '@niubu/base');
    pkg('packages/utils', '@niubu/utils', { dependencies: { '@niubu/base': 'workspace:*' } });
    pkg('internal/tsconfig', '@niubu-internal/tsconfig', { exports: { './base.json': './base.json' } });
    put('internal/tsconfig/base.json', '{"compilerOptions":{"strict":true}}');
    expect(checkWorkspace(root).errors).toEqual([]);
  });
  it('rejects an empty app manifest before treating it as an implemented workspace', () => {
    const { root, put } = fixture();
    put('apps/playground/package.json', JSON.stringify({ name: '@niubu/playground', private: true }));
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/unimplemented/i);
  });
  it.each([
    ['line comment', '// TODO: implement this app\n'],
    ['block comment', '/* TODO: implement this app */'],
    ['empty export', 'export {};'],
    ['type alias', 'export type App = { name: string };'],
    ['interface', 'export interface App { name: string }'],
    ['ambient declaration', 'declare const app: { name: string }; export {};'],
    ['type-only import', "import type { App } from './contracts';"],
    ['inline type-only import', "import { type App } from './contracts';"],
    ['type-only re-export', "export type { App } from './contracts';"],
    ['inline type-only re-export', "export { type App } from './contracts';"],
    ['ambient binding with a local export', 'declare const app: string; export { app };'],
    ['bodyless function declaration', 'export function main(): void;'],
    ['empty statements', '; ;'],
    ['directive only', "'use strict';"],
  ])('rejects %s as an app implementation', (_kind, source) => {
    const { root, put } = fixture();
    put('apps/playground/package.json', JSON.stringify({ name: '@niubu/playground', private: true }));
    put('apps/playground/src/main.ts', source);
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/unimplemented/i);
  });
  it('accepts a tiny app with actual runtime syntax and comment-like text inside a string', () => {
    const { root, put } = fixture();
    put('apps/playground/package.json', JSON.stringify({ name: '@niubu/playground', private: true }));
    put('apps/playground/src/main.ts', "document.body.textContent = '// real app';");
    expect(checkWorkspace(root).errors).toEqual([]);
  });
  it('rejects a type-only import-equals app whose actual emitted module has no runtime code', () => {
    const { root, put } = fixture();
    put('apps/playground/package.json', JSON.stringify({ name: '@niubu/playground', private: true }));
    put('apps/playground/src/main.ts', "import type App = require('./contracts'); export type Shape = App.Contract;");
    put('apps/playground/src/contracts.d.ts', 'export interface Contract { name: string }');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/unimplemented/i);
  });
  it('rejects a type-only namespace that TypeScript completely erases', () => {
    const { root, put } = fixture();
    put('apps/playground/package.json', JSON.stringify({ name: '@niubu/playground', private: true }));
    put('apps/playground/src/main.ts', 'namespace App { export interface Contract { name: string } } export {};');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/unimplemented/i);
  });
  it('preserves a type-only public contract package without treating it as a runtime app', () => {
    const { root, put, pkg } = fixture();
    pkg('packages/contracts', '@niubu/contracts');
    put('packages/contracts/src/index.ts', 'export interface App { name: string }');
    expect(checkWorkspace(root).errors).toEqual([]);
  });
  it('rejects a package dependency cycle', () => {
    const { root, pkg } = fixture();
    pkg('packages/a', '@niubu/a', { dependencies: { '@niubu/b': 'workspace:*' } });
    pkg('packages/b', '@niubu/b', { devDependencies: { '@niubu/a': 'workspace:*' } });
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/cycle/i);
  });
  it('rejects missing public export source files', () => {
    const { root, pkg } = fixture();
    pkg('packages/a', '@niubu/a', { exports: { './missing': './src/missing.ts' } });
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/export.*missing/i);
  });
  it('rejects source export symlinks that escape their package', () => {
    const { root, pkg } = fixture();
    pkg('packages/a', '@niubu/a');
    pkg('packages/b', '@niubu/b');
    symlinkSync(join(root, 'packages/b/src/index.ts'), join(root, 'packages/a/src/escape.ts'));
    pkg('packages/a', '@niubu/a', { exports: { '.': './src/escape.ts' } });
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/export.*escape/i);
  });
  it('rejects wildcard exports and empty runtime placeholders', () => {
    const { root, put, pkg } = fixture();
    pkg('packages/a', '@niubu/a', { exports: { './*': './src/*' } });
    pkg('packages/b', '@niubu/b');
    put('packages/b/src/index.ts', 'export {};');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/wildcard/i);
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/unimplemented/i);
  });
  it('rejects an app reached transitively from a shared package build closure', () => {
    const { root, pkg } = fixture();
    pkg('packages/a', '@niubu/a', { dependencies: { '@niubu/b': 'workspace:*' } });
    pkg('packages/b', '@niubu/b', { devDependencies: { '@niubu/playground': 'workspace:*' } });
    pkg('apps/playground', '@niubu/playground');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/@niubu\/a.*app/i);
  });
  it('keeps the legacy root app out of shared package build closures before A4', () => {
    const { root, put, pkg } = fixture();
    put('src/main.ts', 'export const legacyApp = 1;');
    pkg('packages/a', '@niubu/a', { dependencies: { 'command-center': 'workspace:*' } });
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/@niubu\/a.*app/i);
  });
  it('rejects app dependencies even when the target exports public source', () => {
    const { root, pkg } = fixture();
    pkg('apps/one', '@fixture/one', { dependencies: { '@fixture/two': 'workspace:*' } });
    pkg('apps/two', '@fixture/two');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/app.*depend.*@fixture\/two/i);
  });
  it.each([
    "import { implemented } from '@fixture/two';",
    "export { implemented } from '../../two/src/index';",
    "void import('../../two/src/index');",
    "const two = require('@fixture/two');",
    "export type Other = import('../../two/src/index').Peer;",
  ])('rejects an undeclared cross-app source edge: %s', source => {
    const { root, put, pkg } = fixture();
    pkg('apps/one', '@fixture/one');
    pkg('apps/two', '@fixture/two');
    put('apps/one/src/consumer.ts', source);
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/app.*import.*@fixture\/two/i);
  });
  it('permits an app importing its own source and shared public packages', () => {
    const { root, put, pkg } = fixture();
    pkg('apps/one', '@fixture/one', { dependencies: { '@fixture/shared': 'workspace:*' } });
    pkg('packages/shared', '@fixture/shared');
    put('apps/one/src/consumer.ts', "import './index'; import '@fixture/shared';");
    expect(checkWorkspace(root).errors).toEqual([]);
  });
  it('rejects workspace dependencies whose owner does not exist', () => {
    const { root, pkg } = fixture();
    pkg('packages/a', '@niubu/a', { dependencies: { '@niubu/missing': 'workspace:*' } });
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/dependency.*missing/i);
  });
  it('rejects duplicate test ownership including a root project reaching into a package', () => {
    const { root, put, pkg } = fixture();
    put('package.json', JSON.stringify({ name: 'command-center', private: true, niubu: { test: { include: ['packages/**/*.test.ts'] } } }));
    pkg('packages/a', '@niubu/a', { niubu: { test: { include: ['src/**/*.test.ts'] } } });
    put('packages/a/src/unit.test.ts', 'export const test = 1;');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/test owner.*2/i);
  });
  it('rejects an unowned unit test and ignores dormant E2E tests', () => {
    const { root, put, pkg } = fixture();
    pkg('packages/a', '@niubu/a');
    put('packages/a/src/unit.test.ts', 'export const test = 1;');
    put('tests/e2e/browser.spec.ts', 'export const browser = 1;');
    const errors = checkWorkspace(root).errors.join('\n');
    expect(errors).toMatch(/test owner.*0/i);
    expect(errors).not.toMatch(/browser.spec/);
  });
  it('does not let E2E patterns enter an owning default unit project', () => {
    const { root, put } = fixture();
    put('package.json', JSON.stringify({ name: 'command-center', private: true, niubu: { test: { include: ['tests/**/*.spec.ts'] } } }));
    put('tests/e2e/browser.spec.ts', 'export const browser = 1;');
    expect(checkWorkspace(root).errors.join('\n')).toMatch(/E2E/i);
  });
});
