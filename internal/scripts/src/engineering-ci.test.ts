import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { discoverFrontendApps } from './frontend-apps';
import { checkWorkspaceLocales } from './locale-check';
import { checkWorkspace } from './workspace-check';
import { checkBoundary, readBoundaryConfig } from './boundary-check';

// Importing an engineering CLI must never dispatch commands or start services.
const ambientSpawns = vi.hoisted(() => [] as unknown[]);
vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => {
    ambientSpawns.push(args);
    return { status: 0 };
  },
}));
import { runChecks } from '../../../scripts/check';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-check-graph-')));
  roots.push(root);
  const put = (file: string, value: unknown) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  put('package.json', { name: 'fixture', private: true });
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n  - 'internal/*'\n");
  put('apps/primary/package.json', {
    name: '@fixture/primary',
    scripts: { build: 'build-app' },
    devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
  });
  put('apps/primary/src/main.ts', "document.body.textContent = 'primary';");
  put('internal/vite-config/package.json', { name: '@niubu-internal/vite-config', exports: './src/index.ts' });
  put('internal/vite-config/src/index.ts', 'export const config = {};');
  put('packages/locales/package.json', { name: '@niubu/locales', exports: './src/index.ts' });
  put('packages/locales/src/index.ts', 'export const locale = 1;');
  for (const locale of ['zh-CN', 'en-US']) {
    put(`packages/locales/src/resources/${locale}/common.json`, { ok: 'OK' });
    put(`apps/primary/src/locales/${locale}/app.json`, { title: 'Primary' });
  }
  put('boundary.config.json', { scan: ['packages'], exclude: [], words: ['widget'], literals: [], allow: [] });
  return { root, put };
}

it('has no command side effects when importing the check CLI', () => {
  expect(ambientSpawns).toEqual([]);
});
it('keeps the complete serial check graph in a valid NoWeb workspace and serializes package tests', () => {
  const { root } = fixture();
  expect(discoverFrontendApps(root).map(app => app.name)).toEqual(['@fixture/primary']);
  expect(checkWorkspaceLocales(root).errors).toEqual([]);
  expect(checkWorkspace(root).errors).toEqual([]);
  expect(checkBoundary(root, readBoundaryConfig(root)).errors).toEqual([]);
  const calls: unknown[] = [];
  expect(
    runChecks({
      root,
      report: () => {},
      spawn: (...args) => {
        calls.push(args);
        return { status: 0 };
      },
    }),
  ).toBe(0);
  expect(calls).toEqual([
    ['pnpm', ['locale:check'], { cwd: root, stdio: 'inherit', shell: false }],
    ['pnpm', ['typecheck'], { cwd: root, stdio: 'inherit', shell: false }],
    ['pnpm', ['lint'], { cwd: root, stdio: 'inherit', shell: false }],
    ['pnpm', ['test', '--concurrency=1'], { cwd: root, stdio: 'inherit', shell: false }],
    ['pnpm', ['build'], { cwd: root, stdio: 'inherit', shell: false }],
    ['pnpm', ['budget:check'], { cwd: root, stdio: 'inherit', shell: false }],
  ]);
});
it.each(['locale:check', 'typecheck', 'lint', 'test', 'build', 'budget:check'])(
  'propagates %s failure immediately and never starts subsequent commands',
  failing => {
    const calls: string[] = [];
    expect(
      runChecks({
        root: fixture().root,
        report: () => {},
        spawn: (_command, args) => {
          calls.push(args[0]);
          return { status: args[0] === failing ? 9 : 0 };
        },
      }),
    ).toBe(9);
    expect(calls).toEqual(
      ['locale:check', 'typecheck', 'lint', 'test', 'build', 'budget:check'].slice(
        0,
        ['locale:check', 'typecheck', 'lint', 'test', 'build', 'budget:check'].indexOf(failing) + 1,
      ),
    );
  },
);
it('keeps workspace-only checks real and stops before spawning on workspace or boundary defects', () => {
  const { root, put } = fixture();
  const calls: unknown[] = [];
  const spawn = (...args: unknown[]) => {
    calls.push(args);
    return { status: 0 };
  };
  expect(runChecks({ root, workspaceOnly: true, report: () => {}, spawn })).toBe(0);
  put('packages/locales/src/index.ts', 'export const widget = 1;');
  expect(runChecks({ root, report: () => {}, spawn })).toBe(1);
  put('packages/locales/src/index.ts', 'export {};');
  expect(runChecks({ root, report: () => {}, spawn })).toBe(1);
  expect(calls).toEqual([]);
});
it('propagates spawn errors and signal termination', () => {
  const { root } = fixture();
  const error = Error('synthetic unavailable command');
  expect(() => runChecks({ root, report: () => {}, spawn: () => ({ status: null, error }) })).toThrow(error);
  expect(runChecks({ root, report: () => {}, spawn: () => ({ status: null }) })).toBe(1);
});

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  [key: string]: unknown;
};
type Workflow = {
  on: Record<string, unknown>;
  permissions: unknown;
  concurrency: unknown;
  env: Record<string, string>;
  jobs: Record<string, { steps: Step[]; [key: string]: unknown }>;
};
function readWorkflow(): Workflow {
  const file = join(repo, '.github/workflows/ci.yml');
  expect(existsSync(file), 'CI workflow must exist').toBe(true);
  // JSON is a strict YAML subset. Keep this workflow machine-readable without another YAML dependency.
  return JSON.parse(readFileSync(file, 'utf8')) as Workflow;
}
it('runs format and the existing complete local check chain under read-only CI permissions', () => {
  const workflow = readWorkflow();
  expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push']);
  expect(workflow.permissions).toEqual({ contents: 'read' });
  expect(workflow.concurrency).toEqual({
    group: '${{ github.workflow }}-${{ github.ref }}',
    'cancel-in-progress': true,
  });
  expect(Object.keys(workflow.jobs)).toEqual(['check']);
  const job = workflow.jobs.check;
  expect(job['runs-on']).toBe('ubuntu-latest');
  expect(job.permissions).toBeUndefined();
  expect(job['continue-on-error']).toBeUndefined();
  expect(job.steps.filter(step => step.run).map(step => step.run)).toEqual([
    'pnpm install --frozen-lockfile --ignore-scripts',
    'pnpm format:check',
    'pnpm check',
  ]);
  expect(workflow.env).toMatchObject({ SKIP_INSTALL_SIMPLE_GIT_HOOKS: '1' });
  for (const step of job.steps) {
    expect(step['continue-on-error']).toBeUndefined();
    expect(step.if).toBeUndefined();
    expect(step.env).toBeUndefined();
  }
  expect(JSON.stringify(workflow)).not.toMatch(
    /test:e2e|playwright|docker|deploy|git push|publish|secrets\.|write-all/,
  );
  // Root integration and Turbo's complete package set must both remain in the same command.
  const root = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  expect(root.scripts.test).toBe('pnpm test:integration && turbo run test');
});
it('pins the supplied verified action SHAs and keeps project runtimes/cache scoped explicitly', () => {
  const steps = readWorkflow().jobs.check.steps;
  expect(steps.filter(step => step.uses).map(step => step.uses)).toEqual([
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413',
    'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1',
  ]);
  expect(steps[0].with).toEqual({ 'persist-credentials': false });
  expect(steps[1].with).toEqual({ version: '11.25.0', run_install: false });
  expect(steps[2].with).toEqual({
    'node-version': '24.16.0',
    cache: 'pnpm',
    'cache-dependency-path': 'pnpm-lock.yaml\n.github/workflows/ci.yml',
  });
});
