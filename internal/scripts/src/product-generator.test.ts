import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyProduct, planProduct } from './product-generator';

const productPath = ['apps', 'web'].join('/');
const owned: string[] = [];
afterEach(() => owned.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'product-generator-')); owned.push(root);
  function put(path: string, value: string) { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), value); }
  put('package.json', JSON.stringify({ name: 'fixture-template', private: true, scripts: { 'dev:starter': 'pnpm --filter @niubu/starter dev' } }));
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
  put('pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/starter:\n    dependencies:\n      '@niubu/utils':\n        specifier: workspace:*\n        version: link:../../packages/utils\n  apps/playground: {}\n");
  put('apps/starter/package.json', JSON.stringify({ name: '@niubu/starter', dependencies: { '@niubu/utils': 'workspace:*' } }));
  put('apps/starter/src/app/config.ts', "export const name = 'Admin Starter'; export const identity = { product: 'starter', appId: 'template-starter', storageNamespace: 'starter' };\n");
  put('apps/starter/src/main.ts', "import '@niubu/utils'; export const key = 'starter.auth.v1';\n");
  for (const locale of ['zh-CN','en-US']) put(`apps/starter/src/locales/${locale}/app.json`, JSON.stringify({ home: 'Home' }));
  put('apps/playground/package.json', JSON.stringify({ name: '@niubu/playground' }));
  put('packages/utils/package.json', JSON.stringify({ name: '@niubu/utils', exports: './src/index.ts' }));
  put('packages/utils/src/index.ts', 'export const test = 1;\n');
  put('internal/test-tool/package.json', JSON.stringify({ name: '@niubu-internal/test-tool', dependencies: { '@niubu/utils': 'workspace:*' } }));
  put('apps/backend-mock/src/profiles.ts', "export const profile = 'starter'; export const id = 'starter.home';\n");
  put('.env', 'PRIVATE=must-not-copy\n'); put('dist/secret.txt', 'output');
  execFileSync('git', ['init','-q'], { cwd: root });
  execFileSync('git', ['add','.'], { cwd: root });
  execFileSync('git', ['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture'], { cwd: root });
  return { root, put, options: { sourceRoot: root, targetDir: join(root, '..', 'unused'), productSlug: 'inventory', displayNameZh: '库存', displayNameEn: 'Inventory' } };
}
function target() { const root=mkdtempSync(join(realpathSync(tmpdir()),'product-target-')); owned.push(root); return join(root,'output'); }

describe('commit-based product generation', () => {
  it('dry-runs without writes, uses committed source and maps scope across the graph', () => {
    const f=fixture(), destination=target();
    f.put('packages/utils/src/index.ts', 'dirty secret');
    const plan=planProduct({ ...f.options, targetDir: destination, publicScope:'@acme' });
    expect(existsSync(destination)).toBe(false);
    applyProduct(plan);
    expect(readFileSync(join(destination,'packages/utils/src/index.ts'),'utf8')).toContain('test = 1');
    expect(readFileSync(join(destination,productPath + '/src/main.ts'),'utf8')).toContain('@acme/utils');
    expect(readFileSync(join(destination,productPath + '/src/main.ts'),'utf8')).toContain('inventory.auth.v1');
    expect(readFileSync(join(destination,'internal/test-tool/package.json'),'utf8')).toContain('@niubu-internal/test-tool');
    expect(readFileSync(join(destination,'internal/test-tool/package.json'),'utf8')).toContain('@acme/utils');
    expect(readFileSync(join(destination,'pnpm-lock.yaml'),'utf8')).toContain(productPath + ':');
    expect(readFileSync(join(destination,'pnpm-lock.yaml'),'utf8')).not.toContain('apps/starter:');
    expect(existsSync(join(destination,'.env'))).toBe(false);
    expect(existsSync(join(destination,'dist'))).toBe(false);
    expect(existsSync(join(destination,'.git'))).toBe(false);
    expect(() => applyProduct(plan)).toThrow(/empty|exists|changed/i);
  });
  it('keeps deterministic output independently of the destination and preserves default scope', () => {
    const f=fixture(), first=planProduct({...f.options,targetDir:target()}), second=planProduct({...f.options,targetDir:target()});
    expect(first.manifest).toEqual(second.manifest);
    expect(first.files).toEqual(second.files);
    expect(first.files.find(file=>file.path===productPath + '/package.json')?.content.toString()).toContain('@niubu' + '/web');
  });
  it.each(['../escape','UPPER','bad space',''])('rejects invalid slug %s before writing', productSlug => {
    const f=fixture(); expect(()=>planProduct({...f.options,targetDir:target(),productSlug})).toThrow(/slug/i);
  });
  it.each(['acme','@acme/path','@niubu-internal','@bad scope'])('rejects unsafe scope %s', publicScope => {
    const f=fixture(); expect(()=>planProduct({...f.options,targetDir:target(),publicScope})).toThrow(/scope/i);
  });
  it('refuses nested source targets, nonempty targets, symlink parents and target drift', () => {
    const f=fixture(); expect(()=>planProduct({...f.options,targetDir:join(f.root,'output')})).toThrow(/source/i);
    const destination=target(); mkdirSync(destination);writeFileSync(join(destination,'user.txt'),'preserve');
    expect(()=>planProduct({...f.options,targetDir:destination})).toThrow(/empty/i);
    const symbolic=target();symlinkSync(f.root,symbolic);
    expect(()=>planProduct({...f.options,targetDir:join(symbolic,'child')})).toThrow(/symbolic/i);
    const drift=target(), plan=planProduct({...f.options,targetDir:drift});mkdirSync(drift);writeFileSync(join(drift,'user.txt'),'preserve');
    expect(()=>applyProduct(plan)).toThrow(/empty|changed/i);
    expect(readFileSync(join(drift,'user.txt'),'utf8')).toBe('preserve');
  });
  it('rejects modified in-memory content before creating any target', () => {
    const f = fixture(), destination = target();
    const plan = planProduct({ ...f.options, targetDir: destination });
    plan.files[0]!.content[0] = 0;
    expect(() => applyProduct(plan)).toThrow(/checksum|manifest/i);
    expect(existsSync(destination)).toBe(false);
  });
});
