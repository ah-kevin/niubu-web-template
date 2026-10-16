import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { sha256 } from '@niubu-internal/node-utils';

const repo = fileURLToPath(new URL('../../..', import.meta.url));
function fixture(options: { omitPlugin?: boolean; missingSource?: boolean; close?: string; site?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'niubu-theme-provenance-'));
  const put = (file: string, source: string | object) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), typeof source === 'string' ? source : JSON.stringify(source)); };
  put('package.json', { name: 'theme-workspace', private: true, type: 'module', packageManager: 'pnpm@11.25.0' });
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n"); put('pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/playground: {}\n");
  put('apps/playground/package.json', { name: '@fixture/playground', private: true, type: 'module' });
  const location = options.site ? 'apps/playground/site' : 'apps/playground';
  put(`${location}/index.html`, '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>');
  put(`${location}/src/main.js`, 'document.body.textContent="app";');
  put(`${location}/src/theme.js`, 'document.documentElement.dataset.theme="theme:"+import.meta.env.VITE_THEME_PROBE+":"+import.meta.env.MODE;');
  put(`${location}/src/unmounted.js`, 'document.body.dataset.never="mounted";');
  put('configuration/env/.env.staging', 'VITE_THEME_PROBE=resolved-staging');
  const factory = JSON.stringify(join(repo, 'internal/vite-config/src/index.ts'));
  const close = options.close ? `config.plugins.push({name:'late-theme-test',enforce:'post',closeBundle:{order:'post',async handler(){await Promise.resolve();${options.close}}}});` : '';
  const prefix = options.site ? 'site/' : '';
  put('configuration/alternate.mts', `import {createWebViteConfig} from ${factory};import {readFileSync,writeFileSync,readdirSync} from 'node:fs';import {join} from 'node:path';const root=${JSON.stringify(root)};const appRoot=join(root,'apps/playground');const config=createWebViteConfig({appRoot,workspaceRoot:root,themeInit:{entry:'src/theme.js',appId:'fixture',environment:'staging',globalName:'FixtureThemeInit'},firstScreen:{appName:'@fixture/playground',modules:{main:'${prefix}src/main.js',theme:'${prefix}src/theme.js'${options.missingSource ? ",unmounted:'src/unmounted.js'" : ''}},variants:{current:{},alternate:{}}}});${options.omitPlugin ? "config.plugins=config.plugins.filter(p=>p.name!=='niubu:theme-init');" : ''}${close}export default {...config,root:join(root,${JSON.stringify(location)}),mode:'staging',base:'/effective/',envDir:join(root,'configuration/env')};`);
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  return { root, dist: join(root, location, 'dist'), run() { return spawnSync(process.execPath, [join(repo, 'internal/scripts/src/build-app.ts'), '--config', join(root, 'configuration/alternate.mts')], { cwd: root, encoding: 'utf8' }); }, clean() { rmSync(root, { recursive: true, force: true }); } };
}
it('seals the actual IIFE and both variants after every close hook using effective config and env', () => {
  const f = fixture({ close: "const html=join(appRoot,'dist/index.html');writeFileSync(html,readFileSync(html,'utf8')+'<!-- final close hook -->');" });
  try {
    const result = f.run(); expect(result.status, result.stdout + result.stderr).toBe(0);
    const roots = JSON.parse(readFileSync(join(f.dist, 'first-screen-roots.json'), 'utf8'));
    const provenance = JSON.parse(readFileSync(join(f.dist, 'build-inputs.json'), 'utf8'));
    expect(roots.themeInit.source).toBe('apps/playground/src/theme.js');
    expect(roots.themeInit.modules).toContain('apps/playground/src/theme.js');
    expect(roots.modules.theme.files).toEqual([roots.themeInit.file]);
    expect(roots.html.classicScripts).toContain(roots.themeInit.file);
    for (const variant of Object.values(roots.variants) as { roots: string[]; requiredModules: string[] }[]) {
      expect(variant.roots).toContain(roots.themeInit.file); expect(variant.requiredModules).toContain('theme');
    }
    const code = readFileSync(join(f.dist, roots.themeInit.file), 'utf8');
    expect(code).toContain('theme:resolved-staging:staging');
    expect(roots.themeInit.sha256).toBe(sha256(code));
    expect(provenance.artifacts[roots.themeInit.file]).toBe(sha256(code));
    const html = readFileSync(join(f.dist, 'index.html'), 'utf8');
    expect(html).toContain('<!-- final close hook -->');
    expect(provenance.artifacts['index.html']).toBe(sha256(html));
    expect(provenance.buildContext.context).toMatchObject({ mode: 'staging', base: '/effective/', envDir: 'configuration/env', configFile: 'configuration/alternate.mts' });
  } finally { f.clean(); }
});
it('uses the effective overridden app root for the independent entry and canonical context', () => {
  const f = fixture({ site: true });
  try {
    const result = f.run(); expect(result.status, result.stdout + result.stderr).toBe(0);
    const roots = JSON.parse(readFileSync(join(f.dist, 'first-screen-roots.json'), 'utf8'));
    const provenance = JSON.parse(readFileSync(join(f.dist, 'build-inputs.json'), 'utf8'));
    expect(roots.themeInit.source).toBe('apps/playground/site/src/theme.js');
    expect(provenance.buildContext.context.root).toBe('apps/playground/site');
    expect(readFileSync(join(f.dist, roots.themeInit.file), 'utf8')).toContain('theme:resolved-staging:staging');
  } finally { f.clean(); }
});
it.each([
  { omitPlugin: true, message: /Missing theme-init IIFE evidence/ },
  { missingSource: true, message: /Missing actual first-screen module.*unmounted/ },
  { close: "const assets=join(appRoot,'dist/assets');const theme=readdirSync(assets).find(f=>f.startsWith('theme-init-'));writeFileSync(join(assets,theme),'tampered');", message: /Final theme-init bytes differ/ },
  { close: "writeFileSync(join(appRoot,'src/theme.js'),'document.body.textContent=\"changed during close\";');", message: /Build input provenance changed/ },
  { close: "writeFileSync(join(root,'configuration/env/.env.staging'),'VITE_THEME_PROBE=changed-during-close');", message: /Build context inputs changed/ },
  { close: "const file=join(appRoot,'dist/index.html');writeFileSync(file,readFileSync(file,'utf8').replace('<head>','<head><link rel=\"stylesheet\" href=\"early.css\">'));", message: /must precede all stylesheets/ },
  { close: "const file=join(appRoot,'dist/index.html');writeFileSync(file,readFileSync(file,'utf8').replace('<head>','<head><style>html { color: red; }</style>'));", message: /must precede all stylesheets and app modules/ },
])('refuses missing mapping or final byte/context/order drift and leaves no seal: $message', options => {
  const f = fixture(options);
  try { const result = f.run(); expect(result.status).not.toBe(0); expect(result.stdout + result.stderr).toMatch(options.message); expect(existsSync(join(f.dist, 'build-inputs.json'))).toBe(false); } finally { f.clean(); }
});
