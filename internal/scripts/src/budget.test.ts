import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import * as budget from './budget.ts';
import { sealBuildContext } from '@niubu-internal/node-utils';
import type { BuildContextSnapshot } from '@niubu-internal/node-utils';
const measureBuilt = budget.measureBuiltOverview;
const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function artifacts() {
  const root = mkdtempSync(join(tmpdir(), 'niubu-budget-'));
  temporary.push(root);
  const inputHash = 'a'.repeat(64);
  const context={mode:'production',base:'/',configFile:false as const,configFileDependencies:[],root:'.',outDir:'dist',envDir:false as const,environment:{}};
  const contextFields={context,inputs:[]};
  const buildContext: BuildContextSnapshot={...contextFields,contextHash:sealBuildContext(inputHash,contextFields)};
  const outputs: Record<string, string> = {
    'assets/entry.js': 'import "./shared.js";console.log("entry");',
    'assets/shared.js': 'console.log("shared");',
    'assets/overview.js': 'import "./shared.js";console.log("overview");',
    'assets/chart.js': 'import "./shared.js";console.log("chart");',
    'assets/en.js': 'console.log("english");',
    'boot/theme.js': '(function(){document.documentElement.dataset.theme="light"})()',
    'assets/main.css': 'body{color:red}',
    'index.html': '<link href="/assets/main.css" rel="stylesheet"><link href="/assets/shared.js" rel="modulepreload"><script src="/boot/theme.js"></script><script src="/assets/entry.js" type="module"></script>',
    '.vite/manifest.json': JSON.stringify({ index: { file: 'assets/entry.js', css: ['assets/main.css'] }, overview: { file: 'assets/overview.js' }, chart: { file: 'assets/chart.js' } }),
  };
  const modules = { overview: { source: 'apps/playground/src/overview.ts', files: ['assets/overview.js'] }, chart: { source: 'packages/chart/src/index.ts', files: ['assets/chart.js'] }, english: { source: 'apps/playground/src/en.ts', files: ['assets/en.js'] } };
  const html = { entries: ['assets/entry.js'], preloads: ['assets/shared.js'], classicScripts: ['boot/theme.js'], stylesheets: ['assets/main.css'] };
  const common = ['assets/entry.js', 'assets/shared.js', 'boot/theme.js', 'assets/overview.js', 'assets/chart.js'];
  const roots = { schemaVersion: 1, appName: '@fixture/app', inputHash, base:'/', contextHash:buildContext.contextHash, html, modules, variants: { current: { requiredModules: ['overview', 'chart'], roots: common }, restored: { requiredModules: ['overview', 'chart', 'english'], roots: [...common, 'assets/en.js'] } } };
  outputs['first-screen-roots.json'] = JSON.stringify(roots);
  for (const [file, content] of Object.entries(outputs)) { mkdirSync(dirname(join(root, 'dist', file)), { recursive: true }); writeFileSync(join(root, 'dist', file), content); }
  const provenance = { schemaVersion: 1, appName: '@fixture/app', inputHash, buildContext, artifacts: Object.fromEntries(Object.entries(outputs).map(([file, content]) => [file, sha(content)])) };
  writeFileSync(join(root, 'dist/build-inputs.json'), JSON.stringify(provenance));
  return { root, inputHash, outputs, roots, provenance, buildContext, measure: () => measureBuilt({ appRoot: root, expectedInputHash: inputHash, expectedBuildContext: buildContext }) };
}

function fixtureCli(fixture: ReturnType<typeof artifacts>, expectedInputHash = fixture.inputHash) {
  const options = { appRoot: fixture.root, expectedInputHash, expectedBuildContext: fixture.buildContext };
  return spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import { runBudgetCli, measureBuiltOverview } from ${JSON.stringify(new URL('./budget.ts', import.meta.url).href)};
    await runBudgetCli(() => measureBuiltOverview(${JSON.stringify(options)}));
  `], { encoding: 'utf8' });
}

describe('built first-screen provenance and budgets', () => {
  it('deduplicates shared roots and accepts exactly 307200 bytes but rejects 307201', () => {
    const graph = new Map([['entry', { gzipBytes: 307199, imports: ['shared'] }], ['shared', { gzipBytes: 1, imports: [] }]]);
    expect(budget.measureClosure(graph, ['entry', 'shared', 'entry'])).toMatchObject({ gzipBytes: 307200, withinBudget: true });
    graph.set('extra', { gzipBytes: 1, imports: ['shared'] });
    expect(budget.measureClosure(graph, ['entry', 'extra']).withinBudget).toBe(false);
  });
  it('measures each named variant from real bytes including classic scripts outside assets', () => {
    const fixture = artifacts();
    const result = fixture.measure();
    const currentFiles = ['assets/entry.js', 'assets/shared.js', 'boot/theme.js', 'assets/overview.js', 'assets/chart.js'];
    const wanted = currentFiles.reduce((sum, file) => sum + gzipSync(fixture.outputs[file], { level: 6 }).length, 0);
    expect(result.variants.current).toMatchObject({ gzipBytes: wanted, members: [...currentFiles].sort(), withinBudget: true });
    expect(result.variants.restored.gzipBytes).toBe(wanted + gzipSync(fixture.outputs['assets/en.js'], { level: 6 }).length);
    expect(result.nonJavaScript.css.map(file => file.file)).toContain('assets/main.css');
  });
  it('rejects a missing context, a re-sealed unexpected mode and changed extra config bytes', () => {
    const fixture=artifacts();
    const provenanceFile=join(fixture.root,'dist/build-inputs.json');
    const original=JSON.stringify(fixture.provenance);
    writeFileSync(provenanceFile,JSON.stringify({...fixture.provenance,buildContext:undefined}));
    expect(fixture.measure).toThrow(/context/i);
    const changed=JSON.parse(original);changed.buildContext.context.mode='staging';
    changed.buildContext.contextHash=sealBuildContext(fixture.inputHash,changed.buildContext);
    writeFileSync(provenanceFile,JSON.stringify(changed));expect(fixture.measure).toThrow(/context/i);
    const file=join(fixture.root,'custom-config.mts');writeFileSync(file,'export default {};');
    fixture.buildContext.inputs=[{file:'custom-config.mts',sha256:sha('export default {};')}];
    fixture.buildContext.contextHash=sealBuildContext(fixture.inputHash,fixture.buildContext);
    fixture.provenance.buildContext=fixture.buildContext;fixture.roots.contextHash=fixture.buildContext.contextHash;
    const roots=JSON.stringify(fixture.roots);writeFileSync(join(fixture.root,'dist/first-screen-roots.json'),roots);fixture.provenance.artifacts['first-screen-roots.json']=sha(roots);
    writeFileSync(provenanceFile,JSON.stringify(fixture.provenance));
    expect(fixture.measure().withinBudget).toBe(true);
    writeFileSync(file,'export default {mode:"staging"};');expect(fixture.measure).toThrow(/context input hash/i);
  });
  it('reports the real oversized emitted union without blocking the migration CLI', () => {
    const fixture = artifacts();
    for (const [file, seed] of [['assets/overview.js', 'zh'], ['assets/en.js', 'en']]) {
      const payload = Array.from({ length: 6200 }, (_, index) => sha(`${seed}:${index}`)).join('');
      fixture.outputs[file] = `console.log("${payload}");`;
      writeFileSync(join(fixture.root, 'dist', file), fixture.outputs[file]);
      fixture.provenance.artifacts[file] = sha(fixture.outputs[file]);
    }
    fixture.roots.variants.restored = {
      requiredModules: ['english'],
      roots: ['assets/entry.js', 'assets/shared.js', 'boot/theme.js', 'assets/en.js'],
    };
    const roots = JSON.stringify(fixture.roots);
    writeFileSync(join(fixture.root, 'dist/first-screen-roots.json'), roots);
    fixture.provenance.artifacts['first-screen-roots.json'] = sha(roots);
    writeFileSync(join(fixture.root, 'dist/build-inputs.json'), JSON.stringify(fixture.provenance));
    const result = fixture.measure();
    expect(Object.values(result.variants).every(variant => variant.withinBudget)).toBe(true);
    expect(result.gzipBytes).toBeGreaterThan(307200);
    expect(result.withinBudget).toBe(false);
    const cli = fixtureCli(fixture);
    expect(cli.status, cli.stderr).toBe(0);
    expect(JSON.parse(cli.stdout)).toMatchObject({ gzipBytes: result.gzipBytes, withinBudget: false, limitBytes: 307200, sizePolicy: 'report-only' });
  });
  it('rejects old input provenance', () => {
    const fixture = artifacts();
    expect(() => measureBuilt({ appRoot: fixture.root, expectedInputHash: 'b'.repeat(64), expectedBuildContext:fixture.buildContext })).toThrow(/input|provenance/i);
    const cli = fixtureCli(fixture, 'b'.repeat(64));
    expect(cli.status).not.toBe(0);
    expect(cli.stderr).toMatch(/input|provenance/i);
    expect(cli.stdout).toBe('');
  });
  it.each(['build-inputs.json', 'first-screen-roots.json'])('rejects missing %s', file => {
    const fixture = artifacts(); rmSync(join(fixture.root, 'dist', file));
    expect(fixture.measure).toThrow(/provenance|roots/i);
  });
  it.each(['assets/entry.js', 'index.html', '.vite/manifest.json', 'first-screen-roots.json'])('rejects altered final %s', file => {
    const fixture = artifacts(); writeFileSync(join(fixture.root, 'dist', file), readFileSync(join(fixture.root, 'dist', file), 'utf8') + ' ');
    expect(fixture.measure).toThrow(/hash|provenance/i);
  });
  it('rejects a required module whose real chunk mapping is missing', () => {
    const fixture = artifacts(); fixture.roots.modules.chart.files = [];
    const bytes = JSON.stringify(fixture.roots); writeFileSync(join(fixture.root, 'dist/first-screen-roots.json'), bytes);
    fixture.provenance.artifacts['first-screen-roots.json'] = sha(bytes);
    writeFileSync(join(fixture.root, 'dist/build-inputs.json'), JSON.stringify(fixture.provenance));
    expect(fixture.measure).toThrow(/root|mapping|module/i);
    const cli = fixtureCli(fixture);
    expect(cli.status).not.toBe(0);
    expect(cli.stderr).toMatch(/root|mapping|module/i);
    expect(cli.stdout).toBe('');
  });
  it('rejects an unexpected emitted asset instead of silently ignoring it', () => {
    const fixture = artifacts(); writeFileSync(join(fixture.root, 'dist/extra.js'), 'console.log("unrecorded")');
    expect(fixture.measure).toThrow(/artifact|provenance/i);
  });
});
