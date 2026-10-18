import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { preferenceControls } from '../../packages/effects/common-ui/src/preferences/control-schema';
const root = fileURLToPath(new NodeURL('../..', import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
it('keeps a standalone template root and every original integration suite', () => {
  const manifest = json('package.json');
  expect(manifest.name).toBe('niubu-web-template');
  expect(manifest.scripts.dev).toBe('node internal/scripts/src/dev-app.ts dev');
  expect(manifest.scripts.preview).toBe('node internal/scripts/src/dev-app.ts preview');
  expect(manifest.scripts['test:e2e']).toBeUndefined();
  expect(manifest.scripts.test).toContain('test:integration');
  expect(manifest.scripts.check).toBe('node scripts/check.ts');
  const apps = readdirSync(join(root, 'apps'))
    .filter(path => existsSync(join(root, 'apps', path, 'package.json')))
    .map(path => json('apps/' + path + '/package.json').name)
    .sort();
  expect(apps).toEqual(['@niubu/backend-mock', '@niubu/playground']);
  const suites = [
    'auth-adapter',
    'auth-renewal',
    'mock-response',
    'playground-auth',
    'playground-startup',
    'return-to',
    'runtime-config',
    'session-login-cancellation',
    'session-request',
    'shell-actions',
    'system-api',
    'system-crud',
    'transfer-ui',
    'transfers',
  ];
  for (const name of suites)
    expect(
      ['.ts', '.tsx'].some(extension => existsSync(join(root, 'tests/integration', name + '.test' + extension))),
      name,
    ).toBe(true);
  expect(json('tsconfig.json').include.some((path: string) => /playwright|apps\/web/.test(path))).toBe(false);
  expect(Object.keys(json('turbo.json').tasks).some(key => key.startsWith('@niubu/web#'))).toBe(false);
});
it('gives every implemented preference an existing contained consumer and test', () => {
  expect(preferenceControls).toHaveLength(86);
  for (const control of preferenceControls) {
    expect(control.availability, control.key).toBe('implemented');
    for (const field of ['consumer', 'test'] as const) {
      const path = control[field];
      expect(path, control.key + ':' + field).not.toMatch(/apps\/web|@niubu\/web/);
      expect(existsSync(resolve(root, path)), control.key + ':' + field + ':' + path).toBe(true);
      const rel = relative(realpathSync(root), realpathSync(resolve(root, path)));
      expect(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), control.key).toBe(true);
    }
  }
});
it('owns its boundary policy and keeps the exact E2E authority and CLAUDE reference', () => {
  const boundary = json('boundary.config.json');
  expect(boundary.scan).toEqual(['packages', 'internal']);
  expect(boundary.allow).toEqual([]);
  expect(boundary.literals).toEqual(expect.arrayContaining(['apps/web', '@niubu/web', 'niubu-web', 'niubu-saas']));
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  const heading = '## E2E 测试授权';
  expect(agents.split(heading)).toHaveLength(2);
  const section = heading + agents.split(heading)[1];
  expect(Buffer.byteLength(section)).toBe(936);
  expect(createHash('sha256').update(section).digest('hex')).toBe(
    '73d7312012c4c615e393dcf7caf58ef3e40a94031b025977566bc191b2647c0d',
  );
  expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
});
it('resolves installed tooling and workspace packages inside this independent root', () => {
  expect(lstatSync(join(root, 'node_modules')).isSymbolicLink()).toBe(false);
  const require = createRequire(join(root, 'package.json'));
  for (const name of ['typescript', 'vite', 'vitest', '@niubu-internal/scripts/build-app']) {
    const actual = realpathSync(require.resolve(name));
    const rel = relative(realpathSync(root), actual);
    expect(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), name + ':' + actual).toBe(true);
  }
});
