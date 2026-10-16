import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { resolveConfig, type InlineConfig } from 'vite';
import {
  hashBuildInputs,
  readWorkspace,
  readBuildContext,
  sha256,
  resolveRuntimeConfig,
  serializeRuntimeConfig,
  type RuntimeConfigDescriptor,
  type BuildProvenanceApi,
} from '@niubu-internal/node-utils';
import { measureBuiltOverview, measureCurrentOverview } from './budget.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { buildApp } from './build-app.ts';

const repo = fileURLToPath(new URL('../../..', import.meta.url));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'niubu-runtime-provenance-'));
  const put = (file: string, value: string | object) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  put('package.json', { name: 'runtime-workspace', private: true, type: 'module', packageManager: 'pnpm@11.25.0' });
  put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n");
  put('pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/first: {}\n");
  put('apps/first/package.json', {
    name: '@fixture/first',
    private: true,
    type: 'module',
    scripts: { build: 'fixture' },
  });
  put(
    'apps/first/index.html',
    '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
  );
  put('apps/first/src/main.js', 'import "./main.css";document.body.textContent="app";');
  put('apps/first/src/main.css', 'body{color:red}');
  put('apps/first/src/theme.js', 'document.documentElement.dataset.theme="fixture";');
  put(
    'apps/first/src/runtime-config.js',
    'export default Object.freeze({fileName:"_app.config.js",schemaVersion:1,defaults:Object.freeze({schemaVersion:1,apiURL:"https://a.example"})});',
  );
  put(
    'apps/first/vite.config.ts',
    `import {createWebViteConfig} from ${JSON.stringify(join(repo, 'internal/vite-config/src/index.ts'))};import descriptor from './src/runtime-config.js';export default createWebViteConfig({appRoot:${JSON.stringify(join(root, 'apps/first'))},workspaceRoot:${JSON.stringify(root)},runtimeConfig:descriptor,themeInit:{entry:'src/theme.js',appId:'first',environment:'production',globalName:'FirstTheme'},firstScreen:{appName:'@fixture/first',modules:{main:'src/main.js',theme:'src/theme.js'},variants:{current:{},restored:{}}}});`,
  );
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  return { root, appRoot: join(root, 'apps/first'), dist: join(root, 'apps/first/dist'), put };
}
it('emits the canonical configuration in a real sealed temporary workspace build', async () => {
  const f = fixture();
  try {
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    expect(existsSync(join(f.dist, '_app.config.js'))).toBe(true);
    expect(readFileSync(join(f.dist, '_app.config.js'), 'utf8')).toBe(
      'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"https://a.example"};\n',
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

const descriptor: RuntimeConfigDescriptor = Object.freeze({
  fileName: '_app.config.js',
  schemaVersion: 1,
  defaults: Object.freeze({ schemaVersion: 1, apiURL: 'https://a.example' }),
});
async function expected(f: ReturnType<typeof fixture>, overrides: InlineConfig = {}) {
  const config = await resolveConfig(
    { root: f.appRoot, logLevel: 'silent', ...overrides },
    'build',
    'production',
    'production',
  );
  const expectedInputHash = hashBuildInputs(readWorkspace(f.root), '@fixture/first');
  return {
    appRoot: config.root,
    workspaceRoot: f.root,
    expectedInputHash,
    expectedRuntimeConfig: descriptor,
    expectedBuildContext: readBuildContext(f.root, expectedInputHash, { ...config, outDir: config.build.outDir }),
  };
}
it('accepts only post-build canonical config mutation, measuring current bytes and resolving the same public startup reader', async () => {
  const f = fixture();
  try {
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    const options = await expected(f),
      before = measureBuiltOverview(options);
    const seal = readFileSync(join(f.dist, 'build-inputs.json'), 'utf8');
    const afterScript =
      'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"https://changed-api.example:8443/"};\n';
    writeFileSync(join(f.dist, '_app.config.js'), afterScript);
    const after = measureBuiltOverview(options);
    process.stdout.write(
      'runtime-config mutation evidence ' +
        JSON.stringify({ before: before.runtimeConfig, after: after.runtimeConfig }) +
        '\n',
    );
    const roots = JSON.parse(readFileSync(join(f.dist, 'first-screen-roots.json'), 'utf8'));
    expect(roots.modules.theme.files).toEqual([roots.themeInit.file]);
    expect(Object.keys(roots.modules)).toEqual(['main', 'theme']);
    expect(after.runtimeConfig).toEqual({
      file: '_app.config.js',
      generatedSha256: sha256(serializeRuntimeConfig(descriptor.defaults)),
      currentSha256: sha256(afterScript),
      rawBytes: Buffer.byteLength(afterScript),
      gzipBytes: gzipSync(afterScript, { level: 6 }).length,
      changed: true,
    });
    expect(before.runtimeConfig?.changed).toBe(false);
    expect(after.gzipBytes - before.gzipBytes).toBe(after.runtimeConfig!.gzipBytes - before.runtimeConfig!.gzipBytes);
    expect(after.runtimeConfig!.rawBytes).not.toBe(before.runtimeConfig!.rawBytes);
    for (const variant of Object.values(after.variants)) expect(variant.members).toContain('_app.config.js');
    expect(after).toMatchObject({
      inputHash: before.inputHash,
      htmlSha256: before.htmlSha256,
      rootsSha256: before.rootsSha256,
      manifestSha256: before.manifestSha256,
      provenanceSha256: before.provenanceSha256,
      limitBytes: 307200,
      sizePolicy: 'report-only',
    });
    expect(after.allJavaScript.filter(chunk => chunk.file !== '_app.config.js')).toEqual(
      before.allJavaScript.filter(chunk => chunk.file !== '_app.config.js'),
    );
    expect(after.nonJavaScript).toEqual(before.nonJavaScript);
    const value = runInNewContext(afterScript + ';globalThis.__APP_RUNTIME_CONFIG__');
    expect(resolveRuntimeConfig(value, 'https://shell.example').apiBaseURL).toBe('https://changed-api.example:8443/');
    expect(
      resolveRuntimeConfig(
        runInNewContext(serializeRuntimeConfig(descriptor.defaults) + ';globalThis.__APP_RUNTIME_CONFIG__'),
        'https://shell.example',
      ).apiBaseURL,
    ).toBe('https://a.example/');
    expect(readFileSync(join(f.dist, 'build-inputs.json'), 'utf8')).toBe(seal);
    expect((await measureCurrentOverview(f.appRoot)).runtimeConfig).toEqual(after.runtimeConfig);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it.each([
  ['url', 'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"javascript:alert(1)"};\n'],
  ['unknown field', 'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"/","extra":true};\n'],
  ['extra JS', 'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"/"};\nalert(1);'],
  ['noncanonical', 'globalThis.__APP_RUNTIME_CONFIG__= {"schemaVersion":1,"apiURL":"/"};\n'],
  ['version', 'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":2,"apiURL":"/"};\n'],
])('rejects post-build invalid configuration: %s', async (_name, source) => {
  const f = fixture();
  try {
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    const options = await expected(f);
    writeFileSync(join(f.dist, '_app.config.js'), source);
    expect(() => measureBuiltOverview(options)).toThrow();
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it.each([
  'missing',
  'extra',
  'rename',
  'html',
  'theme',
  'js',
  'css',
  'manifest',
  'roots',
  'context',
  'input list',
  'toolchain',
  'source environment',
  'source packages',
  'generated',
  'file',
  'schema',
  'extra declaration',
  'missing declaration',
  'artifact mutable',
  'forged current seal',
  'null declaration',
  'array declaration',
  'appName',
  'symlink',
  'escape',
])('keeps every other provenance boundary: %s', async kind => {
  const f = fixture();
  try {
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    const options = await expected(f);
    const provenance = JSON.parse(readFileSync(join(f.dist, 'build-inputs.json'), 'utf8'));
    const roots = JSON.parse(readFileSync(join(f.dist, 'first-screen-roots.json'), 'utf8'));
    const put = (file: string, data: string) => writeFileSync(join(f.dist, file), data);
    if (kind === 'missing') rmSync(join(f.dist, '_app.config.js'));
    else if (kind === 'extra') put('extra.js', 'console.log("extra");');
    else if (kind === 'rename') {
      put('other.config.js', readFileSync(join(f.dist, '_app.config.js'), 'utf8'));
      rmSync(join(f.dist, '_app.config.js'));
    } else if (kind === 'symlink') {
      rmSync(join(f.dist, '_app.config.js'));
      symlinkSync(join(f.appRoot, 'src/main.js'), join(f.dist, '_app.config.js'));
    } else if (['html', 'theme', 'js', 'css', 'manifest', 'roots'].includes(kind)) {
      const file =
        kind === 'html'
          ? 'index.html'
          : kind === 'theme'
            ? roots.themeInit.file
            : kind === 'js'
              ? roots.html.entries[0]
              : kind === 'css'
                ? roots.html.stylesheets[0]
                : kind === 'manifest'
                  ? '.vite/manifest.json'
                  : 'first-screen-roots.json';
      put(file, readFileSync(join(f.dist, file), 'utf8') + ' ');
    } else {
      if (kind === 'context') provenance.buildContext.context.mode = 'staging';
      if (kind === 'input list') provenance.inputs = [];
      if (kind === 'toolchain') provenance.toolchain.node = 'v0.0.0';
      if (kind === 'source environment') provenance.environment.NODE_ENV = 'b'.repeat(64);
      if (kind === 'source packages') provenance.runtimePackages = [];
      if (kind === 'generated') provenance.runtimeConfig.generatedSha256 = 'b'.repeat(64);
      if (kind === 'file') provenance.runtimeConfig.file = 'other.config.js';
      if (kind === 'schema') provenance.runtimeConfig.schemaVersion = 2;
      if (kind === 'extra declaration') provenance.runtimeConfig.mutable = true;
      if (kind === 'missing declaration') delete provenance.runtimeConfig;
      if (kind === 'artifact mutable') provenance.artifacts['_app.config.js'] = { mutable: true };
      if (kind === 'forged current seal') {
        const source = serializeRuntimeConfig({ schemaVersion: 1, apiURL: 'https://forged.example' });
        put('_app.config.js', source);
        provenance.artifacts['_app.config.js'] = sha256(source);
        provenance.runtimeConfig.generatedSha256 = sha256(source);
      }
      if (kind === 'null declaration') provenance.runtimeConfig = null;
      if (kind === 'array declaration') provenance.runtimeConfig = [provenance.runtimeConfig];
      if (kind === 'appName') {
        provenance.appName = '@fixture/second';
        roots.appName = '@fixture/second';
        const bytes = JSON.stringify(roots);
        put('first-screen-roots.json', bytes);
        provenance.artifacts['first-screen-roots.json'] = sha256(bytes);
      }
      if (kind === 'escape') provenance.artifacts['../outside.js'] = 'a'.repeat(64);
      put('build-inputs.json', JSON.stringify(provenance));
    }
    expect(() => measureBuiltOverview(options)).toThrow();
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it.each(['config', 'html-order', 'duplicate', 'defer', 'nomodule', 'late-valid'])(
  'refuses late close hook %s and leaves no seal',
  async kind => {
    const f = fixture();
    try {
      await expect(
        buildApp({
          root: f.appRoot,
          logLevel: 'silent',
          plugins: [
            {
              name: 'late-runtime-test',
              enforce: 'post',
              closeBundle: {
                order: 'post',
                async handler() {
                  await Promise.resolve();
                  const file = join(
                    f.dist,
                    kind === 'config' || kind === 'late-valid' ? '_app.config.js' : 'index.html',
                  );
                  const text = readFileSync(file, 'utf8');
                  const next =
                    kind === 'config'
                      ? text + 'console.log(1);'
                      : kind === 'late-valid'
                        ? 'globalThis.__APP_RUNTIME_CONFIG__={"schemaVersion":1,"apiURL":"https://late.example"};\n'
                        : kind === 'duplicate'
                          ? text.replace('</head>', '<script src="/_app.config.js"></script></head>')
                          : kind === 'defer' || kind === 'nomodule'
                            ? text.replace('src="/_app.config.js"', kind + ' src="/_app.config.js"')
                            : text.replace('<head>', '<head><style>body{color:blue}</style>');
                  writeFileSync(file, next);
                },
              },
            },
          ],
        }),
      ).rejects.toThrow(
        kind === 'late-valid'
          ? /Final runtime configuration bytes differ/
          : kind === 'config'
            ? /RUNTIME_CONFIG_SCRIPT_INVALID/
            : kind === 'duplicate'
              ? /Exactly one runtime configuration/
              : kind === 'defer' || kind === 'nomodule'
                ? /blocking classic script/
                : /must precede all stylesheets/,
      );
      expect(existsSync(join(f.dist, 'build-inputs.json'))).toBe(false);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  },
);
it('reads the frozen descriptor from the actual unique resolved provenance API', async () => {
  const f = fixture();
  try {
    const config = await resolveConfig({ root: f.appRoot, logLevel: 'silent' }, 'build');
    const api = config.plugins.find(plugin => plugin.name === 'niubu:build-provenance')!.api as BuildProvenanceApi;
    expect(api.getRuntimeConfig()).toEqual(descriptor);
    expect(Object.isFrozen(api.getRuntimeConfig())).toBe(true);
    expect(Object.isFrozen(api.getRuntimeConfig()!.defaults)).toBe(true);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

it('respects effective base/root/env overrides while preserving theme, runtime and CSS/module order', async () => {
  const f = fixture();
  try {
    f.put(
      'apps/first/site/index.html',
      '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
    );
    f.put(
      'apps/first/site/src/main.js',
      'import "./main.css";document.body.textContent=import.meta.env.VITE_RUNTIME_PROBE;',
    );
    f.put('apps/first/site/src/main.css', 'body{color:blue}');
    f.put('apps/first/site/src/theme.js', 'document.documentElement.dataset.theme=import.meta.env.VITE_RUNTIME_PROBE;');
    f.put('configuration/env/.env.staging', 'VITE_RUNTIME_PROBE=runtime-staging');
    const alternate = join(f.root, 'configuration/alternate.mts');
    const original = readFileSync(join(f.appRoot, 'vite.config.ts'), 'utf8');
    f.put(
      'configuration/alternate.mts',
      original
        .replace("from './src/runtime-config.js'", "from '../apps/first/src/runtime-config.js'")
        .replace('export default createWebViteConfig(', 'const config=createWebViteConfig(')
        .replace("main:'src/main.js',theme:'src/theme.js'", "main:'site/src/main.js',theme:'site/src/theme.js'") +
        `export default {...config,root:${JSON.stringify(join(f.appRoot, 'site'))},mode:'staging',base:'/effective/',envDir:${JSON.stringify(join(f.root, 'configuration/env'))}};`,
    );
    const overrides = { configFile: alternate, root: join(f.appRoot, 'site') };
    await buildApp({ logLevel: 'silent', ...overrides });
    const options = await expected(f, overrides),
      report = measureBuiltOverview(options);
    const dist = join(f.appRoot, 'site/dist'),
      html = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(html.indexOf('/effective/assets/theme-init-')).toBeLessThan(html.indexOf('/effective/_app.config.js'));
    expect(html.indexOf('/effective/_app.config.js')).toBeLessThan(html.indexOf('type="module"'));
    expect(html.indexOf('/effective/_app.config.js')).toBeLessThan(html.indexOf('rel="stylesheet"'));
    expect(report.buildContext.context).toMatchObject({
      root: 'apps/first/site',
      base: '/effective/',
      mode: 'staging',
      envDir: 'configuration/env',
      configFile: 'configuration/alternate.mts',
    });
    const theme = report.chunks.find(chunk => chunk.file.startsWith('assets/theme-init-'))!;
    expect(readFileSync(join(dist, theme.file), 'utf8')).toContain('runtime-staging');
    writeFileSync(
      join(dist, '_app.config.js'),
      serializeRuntimeConfig({ schemaVersion: 1, apiURL: 'https://override.example' }),
    );
    expect(measureBuiltOverview(options).runtimeConfig?.changed).toBe(true);
    f.put('configuration/env/.env.staging', 'VITE_RUNTIME_PROBE=changed');
    expect(() => measureBuiltOverview(options)).toThrow(/context input hash/i);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it('selects each actual app policy by caller directory or explicit name and rejects ambiguous selection', async () => {
  const f = fixture();
  try {
    f.put('apps/second/package.json', {
      name: '@fixture/second',
      private: true,
      type: 'module',
      scripts: { build: 'fixture' },
    });
    for (const file of ['index.html', 'src/main.js', 'src/main.css', 'src/theme.js'])
      f.put('apps/second/' + file, readFileSync(join(f.appRoot, file), 'utf8'));
    f.put(
      'apps/second/src/runtime-config.js',
      'export default {fileName:"_app.config.js",schemaVersion:1,defaults:{schemaVersion:1,apiURL:"https://second.example"}};',
    );
    f.put(
      'apps/second/vite.config.ts',
      readFileSync(join(f.appRoot, 'vite.config.ts'), 'utf8')
        .replaceAll('apps/first', 'apps/second')
        .replaceAll('@fixture/first', '@fixture/second'),
    );
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    await buildApp({ root: join(f.root, 'apps/second'), logLevel: 'silent' });
    await expect(measureCurrentOverview(f.root)).rejects.toThrow(/ambiguous/i);
    expect((await measureCurrentOverview(f.root, '@fixture/first')).runtimeConfig?.generatedSha256).toBe(
      sha256(serializeRuntimeConfig(descriptor.defaults)),
    );
    const second = await measureCurrentOverview(join(f.root, 'apps/second/src'));
    expect(second.appName).toBe('@fixture/second');
    expect(second.runtimeConfig?.changed).toBe(false);
    expect(second.runtimeConfig?.generatedSha256).toBe(
      sha256(serializeRuntimeConfig({ schemaVersion: 1, apiURL: 'https://second.example' })),
    );
    writeFileSync(join(f.root, 'apps/second/dist/build-inputs.json'), readFileSync(join(f.dist, 'build-inputs.json')));
    await expect(measureCurrentOverview(f.root, '@fixture/second')).rejects.toThrow(/context|input|provenance/i);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it('refuses artifact-declared mutability for an app without a source runtime policy', async () => {
  const f = fixture();
  try {
    const configFile = join(f.appRoot, 'vite.config.ts');
    writeFileSync(configFile, readFileSync(configFile, 'utf8').replace('runtimeConfig:descriptor,', ''));
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    const options = await expected(f);
    expect(measureBuiltOverview({ ...options, expectedRuntimeConfig: undefined }).runtimeConfig).toBeUndefined();
    const file = join(f.dist, 'build-inputs.json'),
      seal = JSON.parse(readFileSync(file, 'utf8'));
    seal.runtimeConfig = {
      file: '_app.config.js',
      schemaVersion: 1,
      generatedSha256: sha256(serializeRuntimeConfig(descriptor.defaults)),
    };
    writeFileSync(file, JSON.stringify(seal));
    expect(() => measureBuiltOverview({ ...options, expectedRuntimeConfig: undefined })).toThrow(
      /no trusted source policy/i,
    );
    await expect(measureCurrentOverview(f.appRoot)).rejects.toThrow(/no trusted source policy/i);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it('keeps descriptor/schema/generator source in source and resolved context evidence', async () => {
  const f = fixture();
  try {
    const before = await expected(f),
      file = join(f.appRoot, 'src/runtime-config.js');
    writeFileSync(file, readFileSync(file, 'utf8') + '\n// descriptor source drift');
    const after = await expected(f);
    expect(after.expectedInputHash).not.toBe(before.expectedInputHash);
    expect(after.expectedBuildContext.contextHash).not.toBe(before.expectedBuildContext.contextHash);
    // Real repository graph must retain the public schema/generator and this tooling in canonical inputs.
    const inputs = readWorkspace(repo);
    const { readBuildInputs } = await import('@niubu-internal/node-utils');
    const files = readBuildInputs(inputs, '@niubu/playground').inputs.map(input => input.file);
    expect(files).toContain('packages/@core/base/shared/src/runtime-config.ts');
    expect(files).toContain('internal/node-utils/src/runtime-config-artifacts.ts');
    expect(files).toContain('internal/vite-config/src/runtime-config-plugin.ts');
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it.each(['missing', 'duplicate'])('rejects %s current provenance policy API', async kind => {
  const f = fixture();
  try {
    const file = join(f.appRoot, 'vite.config.ts'),
      source = readFileSync(file, 'utf8');
    writeFileSync(
      file,
      source.replace('export default createWebViteConfig(', 'const config=createWebViteConfig(') +
        (kind === 'missing'
          ? "config.plugins=config.plugins.filter(p=>p.name!=='niubu:build-provenance');"
          : "config.plugins.push(config.plugins.find(p=>p.name==='niubu:build-provenance')); ") +
        'export default config;',
    );
    await expect(measureCurrentOverview(f.appRoot)).rejects.toThrow(/Exactly one trusted build provenance plugin/i);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

it('keeps an identically named legacy public script immutable when no source policy is configured', async () => {
  const f = fixture();
  try {
    const file = join(f.appRoot, 'vite.config.ts');
    writeFileSync(file, readFileSync(file, 'utf8').replace('runtimeConfig:descriptor,', ''));
    f.put('apps/first/public/_app.config.js', serializeRuntimeConfig(descriptor.defaults));
    await buildApp({ root: f.appRoot, logLevel: 'silent' });
    const options = { ...(await expected(f)), expectedRuntimeConfig: undefined };
    expect(measureBuiltOverview(options).runtimeConfig).toBeUndefined();
    writeFileSync(
      join(f.dist, '_app.config.js'),
      serializeRuntimeConfig({ schemaVersion: 1, apiURL: 'https://legacy-change.example' }),
    );
    expect(() => measureBuiltOverview(options)).toThrow(/Final artifact hash differs/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
