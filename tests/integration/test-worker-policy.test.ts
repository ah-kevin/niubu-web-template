// @vitest-environment node
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { loadConfigFromFile } from 'vite';
import type { ViteUserConfig } from 'vitest/config';
import { createTestConfig } from '@niubu-internal/test-config';

const root = fileURLToPath(new URL('../..', import.meta.url));
afterEach(() => vi.unstubAllEnvs());

for (const environment of ['node', 'jsdom'] as const) {
  it.each([
    [undefined, 2],
    ['', 2],
    ['false', 2],
    ['0', 2],
    ['true', '50%'],
    ['1', '50%'],
  ] as const)(`${environment} consumers use the intended worker budget for CI=%s`, (ci, workers) => {
    vi.stubEnv('CI', ci);
    const config = createTestConfig({ root, environment, include: ['source.test.ts'], setupFiles: ['setup.ts'] });
    expect(config.test).toMatchObject({
      environment,
      include: ['source.test.ts'],
      setupFiles: ['setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      maxWorkers: workers,
    });
  });
}

it.each([
  [undefined, 2],
  ['true', '50%'],
] as const)('actual Root, app and package configurations retain the CI=%s budget', async (ci, workers) => {
  vi.stubEnv('CI', ci);
  const configs = [
    join(root, 'tests/integration/vitest.config.ts'),
    ...globSync(['apps/*/vitest.config.ts', 'packages/**/vitest.config.ts', 'internal/**/vitest.config.ts'], {
      cwd: root,
      exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
    }).map(path => join(root, path)),
  ];
  expect(configs.some(config => config.includes('/apps/'))).toBe(true);
  expect(configs.some(config => config.includes('/packages/'))).toBe(true);
  for (const path of configs) {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path, root, 'silent');
    expect(loaded, path).not.toBeNull();
    const config = loaded!.config as ViteUserConfig;
    expect(config.test?.maxWorkers, path).toBe(workers);
    expect(config.test?.include?.length, path).toBeGreaterThan(0);
  }
});
