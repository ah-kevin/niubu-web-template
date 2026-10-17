import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildApp } from './build-app.ts';
import { prepareDeployment } from './deployment.ts';
const repo = fileURLToPath(new URL('../../..', import.meta.url)),
  roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
async function fixture(base = '/') {
  const root = mkdtempSync(join(tmpdir(), 'niubu-deployment-'));
  roots.push(root);
  const put = (file: string, value: unknown) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  put('package.json', { name: 'deployment-fixture', private: true, type: 'module', packageManager: 'pnpm@11.25.0' });
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'internal/*'\n");
  put(
    'pnpm-lock.yaml',
    "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/primary: {}\n  internal/vite-config: {}\n",
  );
  put('internal/vite-config/package.json', {
    name: '@niubu-internal/vite-config',
    version: '0.1.0',
    private: true,
    exports: { '.': './index.js' },
  });
  put('internal/vite-config/index.js', 'export {};');
  put('apps/primary/package.json', {
    name: '@fixture/primary',
    private: true,
    type: 'module',
    scripts: { build: 'fixture' },
    devDependencies: { '@niubu-internal/vite-config': 'workspace:*' },
  });
  put('apps/backend-mock/package.json', {
    name: '@niubu/backend-mock',
    private: true,
    type: 'module',
    scripts: { dev: 'fixture' },
  });
  put('apps/backend-mock/src.js', 'NIUBU_BACKEND_MOCK_ONLY_STAGE3');
  put(
    'apps/primary/index.html',
    '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
  );
  put('apps/primary/src/main.js', 'import "./main.css";document.body.textContent="ready";');
  put('apps/primary/src/main.css', 'body{color:red}');
  put('apps/primary/public/assets/logo-original.svg', '<svg><title>Current brand</title></svg>');
  put('apps/primary/public/assets/legal.html', '<html>Current terms</html>');
  put('apps/primary/public/assets/legal-20261017.html', '<html>Current terms</html>');
  put('apps/primary/src/theme.js', 'document.documentElement.dataset.theme="fixture";');
  put(
    'apps/primary/vite.config.ts',
    `import {createWebViteConfig} from ${JSON.stringify(join(repo, 'internal/vite-config/src/index.ts'))};export default {...createWebViteConfig({appRoot:${JSON.stringify(join(root, 'apps/primary'))},workspaceRoot:${JSON.stringify(root)},runtimeConfig:{fileName:'_app.config.js',schemaVersion:1,defaults:{schemaVersion:1,apiURL:'/'}},themeInit:{entry:'src/theme.js',appId:'fixture',environment:'production',globalName:'FixtureTheme'},firstScreen:{appName:'@fixture/primary',modules:{main:'src/main.js',theme:'src/theme.js'},variants:{current:{}}}}),base:${JSON.stringify(base)}};`,
  );
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  await buildApp({ root: join(root, 'apps/primary'), logLevel: 'silent' });
  return { root, put, dist: join(root, 'apps/primary/dist'), out: join(root, 'out') };
}
it('packages only the selected sealed frontend and reuses the real compiled canonical config contract', async () => {
  const f = await fixture();
  await prepareDeployment({ workspaceRoot: f.root, appName: '@fixture/primary', outDir: f.out });
  expect(readFileSync(join(f.out, 'html/index.html'), 'utf8')).toContain('type="module"');
  expect(existsSync(join(f.out, 'html/src'))).toBe(false);
  expect(existsSync(join(f.out, 'html/backend-mock'))).toBe(false);
  const original = readFileSync(join(f.out, 'html/_app.config.js'), 'utf8');
  const execute = (apiURL: string | undefined) =>
    spawnSync(
      process.execPath,
      [
        join(f.out, 'runtime/runtime-config.mjs'),
        '--root',
        join(f.out, 'html'),
        '--metadata',
        join(f.out, 'runtime/deployment.json'),
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, ...(apiURL === undefined ? {} : { APP_API_URL: apiURL }) },
        shell: false,
      },
    );
  expect(execute('https://api.template.invalid:8443').status).toBe(0);
  expect(readFileSync(join(f.out, 'html/_app.config.js'), 'utf8')).toBe(
    'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"https://api.template.invalid:8443"};\n',
  );
  const changed = readFileSync(join(f.out, 'html/_app.config.js'), 'utf8');
  const invalid = execute('https://public.template.invalid/bad-path');
  expect(invalid.status).not.toBe(0);
  expect(invalid.stderr).not.toContain('https://public.template.invalid/bad-path');
  expect(readFileSync(join(f.out, 'html/_app.config.js'), 'utf8')).toBe(changed);
  expect(original).not.toBe(changed);
});
it.each(['/portal/', '/assets/'])(
  'keeps resource base %s without rewriting sealed HTML and applies exact asset caching',
  async base => {
    const f = await fixture(base);
    await prepareDeployment({ workspaceRoot: f.root, appName: '@fixture/primary', outDir: f.out });
    expect(readFileSync(join(f.out, 'html/index.html'), 'utf8')).toBe(readFileSync(join(f.dist, 'index.html'), 'utf8'));
    const nginx = readFileSync(join(f.out, 'nginx.conf'), 'utf8');
    expect(nginx).toContain('~^' + base + '(.*)$ /$1;');
    expect(nginx).toContain('no-store');
    const theme = /src="[^"]*?(assets\/theme-init-[^"]+\.js)"/.exec(
      readFileSync(join(f.dist, 'index.html'), 'utf8'),
    )?.[1];
    expect(theme).toBeTruthy();
    expect(nginx).toContain(JSON.stringify('/' + theme) + ' "public,max-age=31536000,immutable";');
    expect(nginx).toContain('immutable');
    expect(nginx).not.toContain('"/assets/logo-original.svg" "public,max-age=31536000,immutable";');
    expect(nginx).not.toContain('"/assets/legal-20261017.html" "public,max-age=31536000,immutable";');
    expect(readFileSync(join(f.out, 'html/assets/legal.html'), 'utf8')).toBe('<html>Current terms</html>');
    expect(nginx).toContain('location = /api');
    expect(nginx).toContain('try_files /index.html =404');
    expect(nginx).toContain('etag on');
  },
);
it('refuses unknown apps, unsafe/existing outputs and stale/tampered artifacts without replacing files', async () => {
  const f = await fixture();
  await expect(
    prepareDeployment({ workspaceRoot: f.root, appName: '@niubu/backend-mock', outDir: f.out }),
  ).rejects.toThrow();
  expect(existsSync(f.out)).toBe(false);
  await expect(
    prepareDeployment({ workspaceRoot: f.root, appName: '@fixture/primary', outDir: f.root }),
  ).rejects.toThrow();
  expect(readFileSync(join(f.root, 'package.json'), 'utf8')).toContain('deployment-fixture');
  writeFileSync(join(f.dist, 'index.html'), readFileSync(join(f.dist, 'index.html'), 'utf8') + '<!-- changed -->');
  await expect(
    prepareDeployment({ workspaceRoot: f.root, appName: '@fixture/primary', outDir: f.out }),
  ).rejects.toThrow();
  expect(existsSync(f.out)).toBe(false);
});

it('selects the sole non-Playground frontend by default from the real deployment CLI', async () => {
  const f = await fixture();
  const result = spawnSync(process.execPath, [join(repo, 'internal/scripts/src/deployment.ts'), '--out', f.out], {
    cwd: f.root,
    encoding: 'utf8',
    shell: false,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(readFileSync(join(f.out, 'runtime/deployment.json'), 'utf8'))).toEqual({
    schemaVersion: 1,
    appName: '@fixture/primary',
    runtimeConfig: '_app.config.js',
  });
  expect(readFileSync(join(f.out, 'html/index.html'), 'utf8')).toBe(readFileSync(join(f.dist, 'index.html'), 'utf8'));
  expect(existsSync(join(f.out, 'html/backend-mock'))).toBe(false);
});
