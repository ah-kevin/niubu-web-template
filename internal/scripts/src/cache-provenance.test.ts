import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import * as nodeUtils from '@niubu-internal/node-utils';
import { buildApp } from './build-app.ts';
import { build, resolveConfig } from 'vite';
import type { InlineConfig } from 'vite';
import { measureBuiltOverview } from './budget.ts';

const repo = fileURLToPath(new URL('../../..', import.meta.url));
const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const hashInputs = (graph: nodeUtils.WorkspaceGraph, appName: string) => {
  expect(typeof (nodeUtils as Record<string, unknown>).hashBuildInputs, 'canonical input hashing is implemented').toBe('function');
  return ((nodeUtils as Record<string, unknown>).hashBuildInputs as (graph: nodeUtils.WorkspaceGraph, appName: string) => string)(graph, appName);
};
const put = (root: string, file: string, value: string | object) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
function workspace(runtime = false) {
  const root = mkdtempSync(join(tmpdir(), 'niubu-cache-')); temporary.push(root);
  put(root, 'package.json', { name: 'fixture-workspace', private: true, type: 'module', packageManager: 'pnpm@11.25.0' });
  put(root, 'pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
  put(root, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/playground:\n    dependencies:\n      '@fixture/shared':\n        specifier: workspace:*\n        version: link:../../packages/shared\n  packages/shared: {}\n");
  put(root, 'apps/playground/package.json', { name: '@fixture/app', private: true, type: 'module', dependencies: { '@fixture/shared': 'workspace:*' }, scripts: { build: `${JSON.stringify(process.execPath)} ${JSON.stringify(join(repo, 'internal/scripts/src/build-app.ts'))}` } });
  put(root, 'packages/shared/package.json', { name: '@fixture/shared', private: true, type: 'module', exports: './src/index.js', scripts: { build: 'node --check src/index.js' } });
  put(root, 'packages/shared/src/index.js', 'export const value = "before";');
  put(root, 'apps/playground/src/main.js', 'import {value} from "@fixture/shared";document.body.textContent=value;');
  put(root, 'apps/playground/index.html', '<script type="module" src="/src/main.js"></script>');
  put(root, 'apps/playground/vite.config.ts', `import {createWebViteConfig} from ${JSON.stringify(join(repo, 'internal/vite-config/src/index.ts'))};\nimport {fileURLToPath} from 'node:url';\nconst appRoot=fileURLToPath(new URL('.',import.meta.url));\nexport default createWebViteConfig({appRoot,workspaceRoot:fileURLToPath(new URL('../..',import.meta.url)),firstScreen:{appName:'@fixture/app',modules:{overview:'src/main.js',chart:'@fixture/shared'},variants:{current:{}}}});\n`);
  if (runtime) {
    put(root,'apps/playground/index.html','<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>');
    put(root,'apps/playground/src/runtime-config.js','export default {fileName:"_app.config.js",schemaVersion:1,defaults:{schemaVersion:1,apiURL:"https://cache.example"}};');
    const file=join(root,'apps/playground/vite.config.ts');
    writeFileSync(file,"import runtimeConfig from './src/runtime-config.js';\n"+readFileSync(file,'utf8').replace('createWebViteConfig({appRoot,','createWebViteConfig({appRoot,runtimeConfig,'));
  }
  const actualTasks=JSON.parse(readFileSync(join(repo,'turbo.json'),'utf8')).tasks;
  put(root, 'turbo.json', { agentGuidance: false, globalDependencies: ['pnpm-workspace.yaml', 'pnpm-lock.yaml'], tasks: { build: { dependsOn: ['^build'], outputs: [], env: ['VITE_*', 'NODE_ENV'], inputs: actualTasks.build.inputs }, '@fixture/app#build': { dependsOn: ['^build'], outputs: ['dist/**'], env: ['VITE_*', 'NODE_ENV'], inputs: actualTasks['@niubu/playground#build'].inputs } } });
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  mkdirSync(join(root, 'apps/playground/node_modules/@fixture'), { recursive: true }); symlinkSync(join(root, 'packages/shared'), join(root, 'apps/playground/node_modules/@fixture/shared'), 'dir');
  return root;
}
function runBuild(root: string) {
  // Nested fixtures must not inherit the outer Turbo runner's cache controls.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('TURBO_')));
  const result = spawnSync('pnpm', ['--config.verify-deps-before-run=false', '--dir', root, 'exec', 'turbo', 'run', 'build', '--filter', '@fixture/app', '--summarize'], { cwd: root, encoding: 'utf8', env: { ...env, pnpm_config_verify_deps_before_run: 'false', TURBO_TELEMETRY_DISABLED: '1' }, maxBuffer: 4 * 1024 * 1024 });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const runs = join(root, '.turbo/runs');
  const latest = readdirSync(runs).map(file => join(runs, file)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  const summary = JSON.parse(readFileSync(latest, 'utf8')) as { tasks: { taskId: string; hash: string; cache: { status: string } }[] };
  return summary.tasks.find(task => task.taskId === '@fixture/app#build')!;
}
async function currentContext(root: string, options: InlineConfig = {}) {
  const config=await resolveConfig({root:join(root,'apps/playground'),...options},'build','production','production');
  const expectedInputHash=hashInputs(nodeUtils.readWorkspace(root),'@fixture/app');
  return {appRoot:config.root,workspaceRoot:root,expectedInputHash,expectedRuntimeConfig:(config.plugins.find(plugin=>plugin.name==='niubu:build-provenance')?.api as nodeUtils.BuildProvenanceApi | undefined)?.getRuntimeConfig(),expectedBuildContext:nodeUtils.readBuildContext(root,expectedInputHash,{...config,outDir:config.build.outDir})};
}
describe('build inputs and real temporary workspace cache', () => {
  it('restores a real fixture cache hit despite inherited Turbo controls', () => {
    const root = workspace(), dist = join(root, 'apps/playground/dist');
    const inherited = { TURBO_FORCE: 'true', TURBO_CACHE: 'local:rw', TURBO_TELEMETRY_DISABLED: '0', TURBO_FIXTURE_PARENT_PROBE: 'outside' };
    const previous = Object.fromEntries(Object.keys(inherited).map(key => [key, process.env[key]]));
    try {
      Object.assign(process.env, inherited);
      const first = runBuild(root);
      expect(first.cache.status).toBe('MISS');
      const provenance = readFileSync(join(dist, 'build-inputs.json'), 'utf8');
      rmSync(dist, { recursive: true });
      const restored = runBuild(root);
      expect(restored.hash).toBe(first.hash);
      expect(restored.cache.status).toBe('HIT');
      expect(readFileSync(join(dist, 'build-inputs.json'), 'utf8')).toBe(provenance);
      for (const [key, value] of Object.entries(inherited)) expect(process.env[key]).toBe(value);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }, 120000);
  it('forwards mode/base from actual Node CLI and loads staging env into the emitted app', async () => {
    const root=workspace(), appRoot=join(root,'apps/playground');
    const config=join(appRoot,'vite.config.ts');
    put(root,'apps/playground/.env.staging','VITE_CLI_TEST_STAGE=stage-value');
    put(root,'apps/playground/src/main.js','import {value} from "@fixture/shared";document.body.textContent=value+import.meta.env.MODE+import.meta.env.VITE_CLI_TEST_STAGE;');
    writeFileSync(config,readFileSync(config,'utf8').replace('export default createWebViteConfig(', "import {mkdirSync,writeFileSync} from 'node:fs';\nexport default ({mode}) => { mkdirSync(appRoot+'/.turbo',{recursive:true});writeFileSync(appRoot+'/.turbo/cli-mode.json',JSON.stringify({mode}));return createWebViteConfig(") .replace('variants:{current:{}}}});','variants:{current:{}}}});};'));
    const result=spawnSync(process.execPath,[join(repo,'internal/scripts/src/build-app.ts'),'--mode','staging','--base','/custom/'],{cwd:appRoot,encoding:'utf8',env:{...process.env}});
    expect(result.status,result.stdout+result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(appRoot,'.turbo/cli-mode.json'),'utf8')).mode).toBe('staging');
    const html=readFileSync(join(appRoot,'dist/index.html'),'utf8');expect(html).toContain('/custom/assets/');
    const manifest=JSON.parse(readFileSync(join(appRoot,'dist/.vite/manifest.json'),'utf8'));
    const entry=readFileSync(join(appRoot,'dist',manifest['index.html'].file),'utf8');expect(entry).toContain('stage-value');expect(entry).toContain('staging');
    expect(measureBuiltOverview(await currentContext(root,{mode:'staging',base:'/custom/'})).withinBudget).toBe(true);
    const defaultExpected=await currentContext(root);
    expect(()=>measureBuiltOverview(defaultExpected)).toThrow(/context/i);
  });
  it('loads explicit alternate config with its effective mode, root, envDir and output layout', async () => {
    const root=workspace(), appRoot=join(root,'apps/playground'), site=join(appRoot,'site'), configFile=join(root,'configuration/alternate.mts');
    put(root,'apps/playground/site/index.html','<script type="module" src="/src/main.js"></script>');
    put(root,'apps/playground/site/src/main.js','import {value} from "@fixture/shared";document.body.textContent=value+import.meta.env.MODE+import.meta.env.VITE_CLI_TEST_STAGE;');
    put(root,'configuration/env/.env.staging','VITE_CLI_TEST_STAGE=alternate-stage');
    put(root,'configuration/alternate.mts',`import {createWebViteConfig} from ${JSON.stringify(join(repo,'internal/vite-config/src/index.ts'))};
export default () => ({...createWebViteConfig({appRoot:${JSON.stringify(appRoot)},workspaceRoot:${JSON.stringify(root)},firstScreen:{appName:'@fixture/app',modules:{overview:'site/src/main.js',chart:'@fixture/shared'},variants:{current:{}}}}),mode:'staging',base:'/alternate/',root:${JSON.stringify(site)},envDir:${JSON.stringify(join(root,'configuration/env'))},build:{manifest:true,outDir:'layout-dist'}});`);
    const result=spawnSync(process.execPath,[join(repo,'internal/scripts/src/build-app.ts'),'--config',configFile],{cwd:root,encoding:'utf8',env:{...process.env}});
    expect(result.status,result.stdout+result.stderr).toBe(0);
    expect(existsSync(join(site,'layout-dist/build-inputs.json'))).toBe(true);
    expect(existsSync(join(appRoot,'dist'))).toBe(false);
    const expected=await currentContext(root,{root:undefined,configFile});
    expect(expected.expectedBuildContext.context).toMatchObject({mode:'staging',base:'/alternate/',root:'apps/playground/site',outDir:'layout-dist',envDir:'configuration/env',configFile:'configuration/alternate.mts'});
    expect(measureBuiltOverview(expected).withinBudget).toBe(true);
    const manifest=JSON.parse(readFileSync(join(site,'layout-dist/.vite/manifest.json'),'utf8'));
    const entry=readFileSync(join(site,'layout-dist',manifest['index.html'].file),'utf8');expect(entry).toContain('alternate-stage');expect(entry).toContain('staging');
    expect(readFileSync(join(site,'layout-dist/index.html'),'utf8')).toContain('/alternate/assets/');
    expect(expected.expectedBuildContext.inputs.map(input=>input.file)).toContain('configuration/alternate.mts');
    writeFileSync(configFile,readFileSync(configFile,'utf8')+'\n// changed explicit config');
    expect(()=>measureBuiltOverview(expected)).toThrow(/context input hash/i);
  });
  it.each(['js','ts'])('seals root main.%s with consumed generated/evidence/raw sources while excluding resolved output/cache', async extension => {
    const root=workspace(), appRoot=join(root,'apps/playground'), site=join(appRoot,'site'), configFile=join(root,'configuration/direct-root.mts');
    const source=`import {value} from "@fixture/shared";import data from './input.json';import './input.css';import {generated} from './generated/input.js';import evidence from './evidence/input.json';import trace from './trace.log?raw';import metadata from './metadata.tsbuildinfo?raw';document.body.textContent=value+data.label+generated+evidence.label+trace+metadata;`;
    put(root,`apps/playground/site/main.${extension}`,source);
    put(root,'apps/playground/site/input.json',JSON.stringify({label:'before'}));put(root,'apps/playground/site/input.css','body{color:red}');
    put(root,'apps/playground/site/generated/input.js','export const generated="generated-source-before";');
    put(root,'apps/playground/site/evidence/input.json',{label:'evidence-source-before'});
    put(root,'apps/playground/site/trace.log','raw-log-source-before');
    put(root,'apps/playground/site/metadata.tsbuildinfo','raw-metadata-source-before');
    put(root,'apps/playground/site/index.html',`<script type="module" src="/main.${extension}"></script>`);
    put(root,'configuration/direct-root.mts',`import {createWebViteConfig} from ${JSON.stringify(join(repo,'internal/vite-config/src/index.ts'))};export default {...createWebViteConfig({appRoot:${JSON.stringify(appRoot)},workspaceRoot:${JSON.stringify(root)},firstScreen:{appName:'@fixture/app',modules:{overview:'site/main.${extension}',chart:'@fixture/shared'},variants:{current:{}}}}),root:${JSON.stringify(site)},build:{manifest:true,outDir:'release-area'}};`);
    await buildApp({configFile});
    const before=await currentContext(root,{root:undefined,configFile});expect(measureBuiltOverview(before).withinBudget).toBe(true);
    const manifest=JSON.parse(readFileSync(join(site,'release-area/.vite/manifest.json'),'utf8'));
    const entry=readFileSync(join(site,'release-area',manifest['index.html'].file),'utf8');
    for (const consumed of ['generated-source-before','evidence-source-before','raw-log-source-before','raw-metadata-source-before']) expect(entry).toContain(consumed);
    for (const file of ['release-area/probe.js','.turbo/trace.log','.cache/probe.json','.git/HEAD','.vite/cache.json','.vite-temp/config.mjs','.pnpm-store/probe.json','node_modules/probe.js','.superpowers/probe.json','.verification-private/probe.json','playwright-report/probe.html','test-results/probe.json']) put(root,`apps/playground/site/${file}`,'ignored perturbation');
    expect((await currentContext(root,{root:undefined,configFile})).expectedBuildContext.contextHash).toBe(before.expectedBuildContext.contextHash);
    rmSync(join(site,'release-area/probe.js'));
    for (const [file,changed] of [[`main.${extension}`,source+'console.log("changed entry");'],['input.css','body{color:blue}'],['input.json',JSON.stringify({label:'after'})],['generated/input.js','export const generated="generated-source-after";'],['evidence/input.json',JSON.stringify({label:'evidence-source-after'})],['trace.log','raw-log-source-after'],['metadata.tsbuildinfo','raw-metadata-source-after']]) {
      const actual=join(site,file), original=readFileSync(actual);
      try {
        writeFileSync(actual,changed);const after=await currentContext(root,{root:undefined,configFile});
        expect(after.expectedInputHash).toBe(before.expectedInputHash);
        expect(after.expectedBuildContext.contextHash).not.toBe(before.expectedBuildContext.contextHash);
        expect(()=>measureBuiltOverview(after)).toThrow(/context/i);
        expect(()=>measureBuiltOverview(before)).toThrow(/context input hash/i);
      } finally {writeFileSync(actual,original);}
    }
    expect(measureBuiltOverview(await currentContext(root,{root:undefined,configFile})).withinBudget).toBe(true);
  });
  it('accepts the positional app root and pnpm forwarded options with and without a separator', async () => {
    const root=workspace(), appRoot=join(root,'apps/playground');
    const direct=spawnSync(process.execPath,[join(repo,'internal/scripts/src/build-app.ts'),appRoot,'--base','/position/'],{cwd:root,encoding:'utf8'});
    expect(direct.status,direct.stdout+direct.stderr).toBe(0);expect(readFileSync(join(appRoot,'dist/index.html'),'utf8')).toContain('/position/assets/');
    for (const separator of [[],['--']]) {
      const result=spawnSync('pnpm',['--config.verify-deps-before-run=false','--dir',appRoot,'run','build',...separator,'--mode','staging','--base','/pnpm/'],{cwd:root,encoding:'utf8',env:{...process.env,pnpm_config_verify_deps_before_run:'false'}});
      expect(result.status,result.stdout+result.stderr).toBe(0);
      expect(readFileSync(join(appRoot,'dist/index.html'),'utf8')).toContain('/pnpm/assets/');
      const expected=await currentContext(root,{mode:'staging',base:'/pnpm/'});
      expect(measureBuiltOverview(expected).withinBudget).toBe(true);
    }
  });
  it.each([['--watch'],['--ssr'],['--mdoe','staging'],['one','two']])('rejects unsupported or ambiguous CLI arguments %j', (...args) => {
    const root=workspace();const result=spawnSync(process.execPath,[join(repo,'internal/scripts/src/build-app.ts'),...args],{cwd:join(root,'apps/playground'),encoding:'utf8'});
    expect(result.status).not.toBe(0);expect(result.stdout+result.stderr).toMatch(/option|argument|root/i);
  });
  it('hashes upstream runtime source and actual config but excludes tool-owned outputs', () => {
    const root = workspace(), graph = nodeUtils.readWorkspace(root), before = hashInputs(graph, '@fixture/app');
    put(root, 'packages/shared/.turbo/trace.ts', 'tool output'); put(root, 'apps/playground/dist/probe.js', 'output'); put(root, 'apps/playground/.turbo/build.log', 'log');
    expect(hashInputs(graph, '@fixture/app')).toBe(before);
    put(root, 'packages/shared/src/index.js', 'export const value="after";');
    expect(hashInputs(graph, '@fixture/app')).not.toBe(before);
    put(root, 'packages/shared/src/index.js', 'export const value = "before";');
    expect(hashInputs(graph, '@fixture/app')).toBe(before);
    put(root, 'apps/playground/vite.config.ts', readFileSync(join(root, 'apps/playground/vite.config.ts'), 'utf8') + '// config input\n');
    expect(hashInputs(graph, '@fixture/app')).not.toBe(before);
  });
  it('seals consumed runtime sources under generated/evidence and raw resource extensions', async () => {
    const root=workspace(), appRoot=join(root,'apps/playground');
    const sources=[['generated/input.js','export const generated="runtime-generated-before";','export const generated="runtime-generated-after";'],['evidence/input.json',JSON.stringify({label:'runtime-evidence-before'}),JSON.stringify({label:'runtime-evidence-after'})],['trace.log','runtime-log-before','runtime-log-after'],['metadata.tsbuildinfo','runtime-metadata-before','runtime-metadata-after'],['dist/input.js','export const nested="runtime-nested-dist-before";','export const nested="runtime-nested-dist-after";']];
    put(root,'packages/shared/src/index.js','import {generated} from "./generated/input.js";import evidence from "./evidence/input.json";import trace from "./trace.log?raw";import metadata from "./metadata.tsbuildinfo?raw";import {nested} from "./dist/input.js";export const value=generated+evidence.label+trace+metadata+nested;');
    for (const [file,original] of sources) put(root,`packages/shared/src/${file}`,original);
    await buildApp({root:appRoot});
    const before=await currentContext(root);
    expect(measureBuiltOverview(before).withinBudget).toBe(true);
    const manifest=JSON.parse(readFileSync(join(appRoot,'dist/.vite/manifest.json'),'utf8'));
    const entry=readFileSync(join(appRoot,'dist',manifest['index.html'].file),'utf8');
    for (const consumed of ['runtime-generated-before','runtime-evidence-before','runtime-log-before','runtime-metadata-before','runtime-nested-dist-before']) expect(entry).toContain(consumed);
    for (const [file,original,changed] of sources) {
      try {
        put(root,`packages/shared/src/${file}`,changed);
        const after=await currentContext(root);
        expect(after.expectedInputHash).not.toBe(before.expectedInputHash);
        expect(()=>measureBuiltOverview(after)).toThrow(/input|context/i);
      } finally {put(root,`packages/shared/src/${file}`,original);}
    }
    expect(measureBuiltOverview(await currentContext(root)).withinBudget).toBe(true);
  });
  it('separates runtime dependencies/peers/optional from tooling and hashes design values/generator/env/lock', () => {
    const root = workspace();
    put(root, 'packages/design/package.json', {name:'@fixture/design',exports:'./src/values.ts'});
    put(root, 'packages/design/src/values.ts', 'export const spacing=4;');
    put(root, 'packages/design/scripts/generate-css.ts', 'export const generation=1;');
    put(root, 'packages/peer/package.json', {name:'@fixture/peer',exports:'./src/index.ts'});
    put(root, 'packages/peer/src/index.ts', 'export const peer=1;');
    put(root, 'packages/developer/package.json', {name:'@fixture/developer',exports:'./src/index.ts'});
    put(root, 'packages/developer/src/index.ts', 'export const development=1;');
    const manifest = JSON.parse(readFileSync(join(root,'apps/playground/package.json'),'utf8'));
    manifest.optionalDependencies={'@fixture/design':'workspace:*'};manifest.peerDependencies={'@fixture/peer':'workspace:*'};manifest.devDependencies={'@fixture/developer':'workspace:*'};
    put(root,'apps/playground/package.json',manifest);
    const graph=nodeUtils.readWorkspace(root), before=nodeUtils.readBuildInputs(graph,'@fixture/app');
    expect(before.runtimePackages).toEqual(['@fixture/app','@fixture/design','@fixture/peer','@fixture/shared']);
    expect(before.toolPackages).toContain('@fixture/developer');
    for (const file of ['packages/design/src/values.ts','packages/design/scripts/generate-css.ts','pnpm-lock.yaml']) {
      const original=readFileSync(join(root,file),'utf8');put(root,file,original+'\n// changed input');
      expect(hashInputs(graph,'@fixture/app')).not.toBe(before.inputHash);put(root,file,original);
      expect(hashInputs(graph,'@fixture/app')).toBe(before.inputHash);
    }
    const previous=process.env.VITE_A5_INPUT_PROBE;
    try {process.env.VITE_A5_INPUT_PROBE='probe';expect(hashInputs(graph,'@fixture/app')).not.toBe(before.inputHash);}
    finally {if(previous===undefined)delete process.env.VITE_A5_INPUT_PROBE;else process.env.VITE_A5_INPUT_PROBE=previous;}
  });
  it('refuses unfinalized direct Vite artifacts and does not make absent root modules new entries', async () => {
    const root = workspace();
    await build({root:join(root,'apps/playground')});
    const expected=await currentContext(root);
    expect(()=>measureBuiltOverview(expected)).toThrow(/provenance|roots/i);
    put(root,'apps/playground/src/unused.js','export const unused=1;');
    const configFile=join(root,'apps/playground/vite.config.ts');
    writeFileSync(configFile,readFileSync(configFile,'utf8').replace("modules:{overview:","modules:{unused:'src/unused.js',overview:"));
    await expect(buildApp({root:join(root,'apps/playground')})).rejects.toThrow(/mapping.*unused/i);
  });
  it('finalizes bytes after a later post closeBundle hook has changed HTML', async () => {
    const root = workspace();
    await buildApp({ root: join(root, 'apps/playground'), plugins: [{ name: 'late-html', enforce: 'post', closeBundle: { order: 'post', async handler() { const file = join(root, 'apps/playground/dist/index.html'); await Promise.resolve(); writeFileSync(file, readFileSync(file, 'utf8') + '<!-- final emitted HTML -->'); } } }] });
    const inputHash = hashInputs(nodeUtils.readWorkspace(root), '@fixture/app');
    const expected=await currentContext(root);
    expect(expected.expectedInputHash).toBe(inputHash);
    expect(measureBuiltOverview(expected).withinBudget).toBe(true);
  });
  it('rejects changed build inputs during a later closeBundle hook', async () => {
    const root = workspace();
    await expect(buildApp({ root: join(root, 'apps/playground'), plugins: [{ name: 'change-input', closeBundle() { put(root, 'packages/shared/src/index.js', 'export const value="changed during build";'); } }] })).rejects.toThrow(/input|provenance/i);
    expect(existsSync(join(root, 'apps/playground/dist/build-inputs.json'))).toBe(false);
  });
  it('rejects consumed generated source changes during final close hooks even when the pure source hash stays unchanged', async () => {
    const root=workspace();
    put(root,'apps/playground/src/main.js','import {value} from "@fixture/shared";import {generated} from "../generated/input.js";document.body.textContent=value+generated;');
    put(root,'apps/playground/generated/input.js','export const generated="before";');
    const before=hashInputs(nodeUtils.readWorkspace(root),'@fixture/app');
    await expect(buildApp({root:join(root,'apps/playground'),plugins:[{name:'late-consumed-source',closeBundle(){put(root,'apps/playground/generated/input.js','export const generated="after";');}}]})).rejects.toThrow(/context inputs changed/i);
    expect(hashInputs(nodeUtils.readWorkspace(root),'@fixture/app')).toBe(before);
    expect(existsSync(join(root,'apps/playground/dist/build-inputs.json'))).toBe(false);
  });
  it.each(['config','env'])('rejects extra %s input changes during final close hooks even when the pure source hash stays unchanged', async kind => {
    const root=workspace(), appRoot=join(root,'apps/playground'), configFile=join(root,'configuration/build.mts'), envDir=join(root,'configuration/env');
    put(root,'configuration/build.mts',`import {createWebViteConfig} from ${JSON.stringify(join(repo,'internal/vite-config/src/index.ts'))};export default {...createWebViteConfig({appRoot:${JSON.stringify(appRoot)},workspaceRoot:${JSON.stringify(root)},firstScreen:{appName:'@fixture/app',modules:{overview:'src/main.js',chart:'@fixture/shared'},variants:{current:{}}}}),envDir:${JSON.stringify(envDir)}};`);
    put(root,'configuration/env/.env.production','VITE_CLOSE_TEST=value');
    const before=hashInputs(nodeUtils.readWorkspace(root),'@fixture/app'), changed=kind==='config'?configFile:join(envDir,'.env.production');
    await expect(buildApp({root:appRoot,configFile,plugins:[{name:'late-context-input',closeBundle(){writeFileSync(changed,readFileSync(changed,'utf8')+'\n'+(kind==='config'?'// changed config':'# changed env'));}}]})).rejects.toThrow(/context inputs changed/i);
    expect(hashInputs(nodeUtils.readWorkspace(root),'@fixture/app')).toBe(before);
    expect(existsSync(join(appRoot,'dist/build-inputs.json'))).toBe(false);
  });
  it('changes source provenance on real upstream/config edits and restores complete dist on cache hit', () => {
    const root = workspace();
    put(root,'packages/shared/src/index.js','import {generated} from "./generated/input.js";import evidence from "./evidence/input.json";import trace from "./trace.log?raw";export const value=generated+evidence.label+trace;');
    put(root,'packages/shared/src/generated/input.js','export const generated="before-generated";');
    put(root,'packages/shared/src/evidence/input.json',{label:'before-evidence'});
    put(root,'packages/shared/src/trace.log','before-log');
    const graph = nodeUtils.readWorkspace(root), beforeInput = hashInputs(graph, '@fixture/app');
    const before = runBuild(root);
    const provenance = JSON.parse(readFileSync(join(root, 'apps/playground/dist/build-inputs.json'), 'utf8')) as { inputHash: string };
    expect(provenance.inputHash).toBe(beforeInput);
    let previous=before;
    for (const [file,changed] of [['generated/input.js','export const generated="after-generated";'],['evidence/input.json',JSON.stringify({label:'after-evidence'})],['trace.log','after-log']]) {
      put(root,`packages/shared/src/${file}`,changed);
      const consumed=runBuild(root);
      expect(consumed.hash).not.toBe(previous.hash);expect(consumed.cache.status).toBe('MISS');
      expect(JSON.parse(readFileSync(join(root,'apps/playground/dist/build-inputs.json'),'utf8')).inputHash).toBe(hashInputs(graph,'@fixture/app'));
      previous=consumed;
    }
    put(root, 'packages/shared/src/index.js', 'export const value="after";');
    const changed = runBuild(root);
    expect(changed.hash).not.toBe(previous.hash); expect(changed.cache.status).toBe('MISS');
    expect(JSON.parse(readFileSync(join(root, 'apps/playground/dist/build-inputs.json'), 'utf8')).inputHash).toBe(hashInputs(graph, '@fixture/app'));
    put(root, 'apps/playground/vite.config.ts', readFileSync(join(root, 'apps/playground/vite.config.ts'), 'utf8') + '// actual tool config change\n');
    const configured = runBuild(root); expect(configured.hash).not.toBe(changed.hash); expect(configured.cache.status).toBe('MISS');
    const finalProvenance = readFileSync(join(root, 'apps/playground/dist/build-inputs.json'), 'utf8');
    rmSync(join(root, 'apps/playground/dist'), { recursive: true });
    const restored = runBuild(root);
    expect(restored.hash).toBe(configured.hash); expect(restored.cache.status).toBe('HIT');
    for (const file of ['.vite/manifest.json', 'index.html', 'first-screen-roots.json', 'build-inputs.json']) expect(existsSync(join(root, 'apps/playground/dist', file))).toBe(true);
    expect(readFileSync(join(root, 'apps/playground/dist/build-inputs.json'), 'utf8')).toBe(finalProvenance);
  }, 120000);
});

it('restores the full immutable seal and generated runtime bytes from a real cache after post-build config edits',async()=>{
  const root=workspace(true),dist=join(root,'apps/playground/dist');
  const first=runBuild(root);expect(first.cache.status).toBe('MISS');
  const options=await currentContext(root),before=measureBuiltOverview(options);
  const originalSeal=readFileSync(join(dist,'build-inputs.json'),'utf8');
  put(root,'apps/playground/dist/_app.config.js',nodeUtils.serializeRuntimeConfig({schemaVersion:1,apiURL:'https://post-build.example'}));
  expect(measureBuiltOverview(options).runtimeConfig?.changed).toBe(true);
  rmSync(dist,{recursive:true});const restored=runBuild(root);
  expect(restored.hash).toBe(first.hash);expect(restored.cache.status).toBe('HIT');
  expect(readFileSync(join(dist,'build-inputs.json'),'utf8')).toBe(originalSeal);
  expect(measureBuiltOverview(await currentContext(root)).runtimeConfig).toEqual(before.runtimeConfig);
});
