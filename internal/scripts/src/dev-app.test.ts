import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runDevApp } from './dev-app';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture(names = ['primary']) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-dev-dispatch-')));
  roots.push(root);
  const put = (file: string, value: unknown) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  put('package.json', { name: 'fixture' });
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n");
  for (const name of names)
    put(`apps/${name}/package.json`, {
      name: `@fixture/${name}`,
      scripts: { dev: 'vite', preview: 'vite preview', build: 'build-app' },
      devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
    });
  return root;
}
it('selects the sole frontend and forwards all Vite arguments with no shell', () => {
  const root = fixture();
  const calls: unknown[] = [];
  expect(
    runDevApp({
      root,
      args: ['dev', '--port', '5188', '--host', '127.0.0.1'],
      spawn: (...args) => {
        calls.push(args);
        return { status: 0 };
      },
    }),
  ).toBe(0);
  expect(calls).toEqual([
    [
      'pnpm',
      ['--filter', '@fixture/primary', 'dev', '--port', '5188', '--host', '127.0.0.1'],
      { cwd: root, stdio: 'inherit', shell: false },
    ],
  ]);

});
it('selects an explicit app and strips only the dispatcher option and initial pnpm separator', () => {
  const root = fixture(['primary', 'secondary']);
  const calls: unknown[] = [];
  expect(
    runDevApp({
      root,
      args: ['preview', '--', '--app=@fixture/primary', '--port=5190', '--base', '/a b/'],
      spawn: (...args) => {
        calls.push(args);
        return { status: 0 };
      },
    }),
  ).toBe(0);
  expect(calls).toEqual([
    [
      'pnpm',
      ['--filter', '@fixture/primary', 'preview', '--port=5190', '--base', '/a b/'],
      { cwd: root, stdio: 'inherit', shell: false },
    ],
  ]);
});
it('defaults to the sole primary in a single-frontend workspace and propagates child failure', () => {
  const root = fixture(['primary']);
  const calls: unknown[] = [];
  expect(
    runDevApp({
      root,
      args: ['dev', '--app', '@fixture/primary', '--port', '5179'],
      spawn: (...args) => {
        calls.push(args);
        return { status: 7 };
      },
    }),
  ).toBe(7);
  expect(calls[0]).toEqual([
    'pnpm',
    ['--filter', '@fixture/primary', 'dev', '--port', '5179'],
    { cwd: root, stdio: 'inherit', shell: false },
  ]);
  expect(
    runDevApp({
      root,
      args: ['preview'],
      spawn: (_command, args) => {
        expect(args).toEqual(['--filter', '@fixture/primary', 'preview']);
        return { status: null };
      },
    }),
  ).toBe(1);
});
it.each([
  ['dev', '--app', '@niubu/missing'],
  ['dev', '--app'],
  ['dev', '--app', '--port', '5173'],
  ['dev', '--app='],
  ['dev', '--app', '@fixture/primary', '--app=@fixture/primary'],
  ['build'],
])('rejects invalid dispatch before spawning: %j', (...args) => {
  expect(() =>
    runDevApp({
      root: fixture(),
      args,
      spawn: () => {
        throw Error('must not spawn');
      },
    }),
  ).toThrow(/unknown|app|dev.*preview/i);
});
it('rejects an ambiguous default and propagates spawn errors', () => {
  expect(() =>
    runDevApp({
      root: fixture(['one', 'two']),
      args: ['dev'],
      spawn: () => {
        throw Error('must not spawn');
      },
    }),
  ).toThrow(/ambiguous/i);
  const error = new Error('synthetic spawn failure');
  expect(() => runDevApp({ root: fixture(), args: ['dev'], spawn: () => ({ status: null, error }) })).toThrow(error);
});
