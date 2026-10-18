import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build, resolveConfig, type Plugin } from 'vite';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { readWorkspace, resolveWorkspaceImport } from '@niubu-internal/node-utils';
import * as config from './index.ts';
import { buildProvenance } from './build-provenance.ts';
import { assertThemeInitHead } from './theme-init-plugin.ts';

const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url));
const fixtureRoot = resolve(workspaceRoot, 'internal/vite-config');
const entry = resolve(fixtureRoot, 'src/tests/fixtures/theme-entry.js');
// Read the explicit fixture contract through Node without loading an app or preference manager.
const contractResult = spawnSync(process.execPath, ['--input-type=module', '--eval', `
  import { themeContract } from ${JSON.stringify(new URL('./tests/fixtures/theme-contract.js', import.meta.url).href)};
  console.log(JSON.stringify(themeContract));
`], { cwd: workspaceRoot, encoding: 'utf8' });
expect(contractResult.status, contractResult.stderr).toBe(0);
const contract: { appId: string; environment: string; hintedKey: string; anonymousKey: string; hintKey: string; blockedKey: string } = JSON.parse(contractResult.stdout);
// Resolve the declared test dependencies through public exports; no app entry is part of this fixture.
const fixtureAliases = Object.fromEntries(['@niubu/preferences/pure', '@niubu/hooks/storage', '@niubu/hooks/theme-dom'].map(specifier => {
  const result = resolveWorkspaceImport(readWorkspace(workspaceRoot), entry, specifier);
  if (result.kind !== 'workspace' || !result.isPublic) throw new Error(`Missing public fixture export: ${specifier}`);
  return [specifier, result.file];
}));
const validHint = JSON.stringify({ version: 1, identityKey: 'fixture-user' });
function evaluateTheme(code: string, options: { hint?: string | null; blocked?: boolean; missingSessionGetter?: boolean; unavailableStorage?: boolean } = {}) {
  const dataset: Record<string, string> = {}, styles = new Map<string, string>(), reads: string[] = [];
  let writes = 0, listeners = 0;
  const target = { dataset, classList: { toggle: () => {} }, style: { setProperty: (key: string, value: string) => styles.set(key, value) } };
  const sessionStorage = options.missingSessionGetter ? {} : {
    getItem: (key: string) => key === contract.blockedKey ? (options.blocked ? '1' : null) : key === contract.hintKey ? (options.hint === undefined ? validHint : options.hint) : null,
    setItem: () => { writes++; },
  };
  runInNewContext(code, {
    document: { documentElement: target },
    window: {
      sessionStorage,
      localStorage: {
        getItem: (key: string) => {
          reads.push(key);
          if (options.unavailableStorage) throw Error('fixture storage unavailable');
          return key === contract.hintedKey ? '{"schemaVersion":1,"core":{"theme":{"mode":"system"},"density":"compact"},"extensions":{},"migrations":[]}' : null;
        },
        setItem: () => { writes++; },
      },
      matchMedia: () => ({ matches: true, addEventListener: () => { listeners++; } }),
    },
  });
  return { dataset, styles, reads, writes, listeners };
}
it('rejects inline style before the theme classic and accepts inline style afterwards', () => {
  const src = '/assets/theme-init-probe.js';
  const script = `<script src="${src}"></script>`;
  const style = '<style>html { color: red; }</style>';
  expect(() => assertThemeInitHead(`<html><head>${style}${script}</head></html>`, src)).toThrow(/must precede all stylesheets and app modules/);
  expect(() => assertThemeInitHead(`<html><head>${script}${style}</head></html>`, src)).not.toThrow();
});
function plugin(overrides: Record<string, string> = {}) {
  const factory = (config as unknown as { themeInitPlugin?: (options: unknown) => Plugin }).themeInitPlugin;
  expect(typeof factory).toBe('function');
  return factory!({ entry, appId: contract.appId, environment: contract.environment, globalName: 'TemplateThemeInit', ...overrides });
}
it('exposes theme exports under the configured classic global', async () => {
  const root = mkdtempSync(join(tmpdir(), 'template-global-'));
  try {
    writeFileSync(join(root, 'theme.js'), 'export const initialized = true;');
    writeFileSync(join(root, 'index.html'), '<html><head></head><body></body></html>');
    const result = await build({
      configFile: false, root, logLevel: 'silent', resolve: { alias: fixtureAliases },
      plugins: [plugin({ entry: join(root, 'theme.js'), globalName: 'TemplateThemeInit' })],
      build: { write: false },
    });
    const built = Array.isArray(result) ? result[0] : result;
    if (!('output' in built)) throw Error('Unexpected watcher');
    const script = built.output.find(item => item.type === 'asset' && item.fileName.startsWith('assets/theme-init-'));
    const context: { TemplateThemeInit?: { initialized: boolean } } = {};
    runInNewContext(String((script as { source: string }).source), context);
    expect(context.TemplateThemeInit?.initialized).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it('only accepts configured theme entry evidence with a real single-entry IIFE module mapping', () => {
  const provenance = buildProvenance({ appRoot: fixtureRoot, workspaceRoot, firstScreen: { appName: '@niubu-internal/vite-config', modules: { themeInit: 'src/tests/fixtures/theme-entry.js' }, variants: { current: {} } }, themeInit: { entry, appId: contract.appId, environment: contract.environment, globalName: 'TemplateThemeInit' } });
  const register = (provenance.api as unknown as { registerThemeInitIife?: (evidence: unknown) => void }).registerThemeInitIife;
  expect(typeof register).toBe('function');
  const chunk = { code: '(function(){})();', facadeModuleId: entry, moduleIds: [entry], imports: [], dynamicImports: [], isEntry: true };
  expect(() => register!({ entry: resolve(fixtureRoot, 'src/index.ts'), fileName: 'assets/theme.js', chunk })).toThrow(/configured theme entry/i);
  expect(() => register!({ entry, fileName: 'assets/theme.js', chunk: { ...chunk, moduleIds: [] } })).toThrow(/module evidence/i);
  expect(() => register!({ entry, fileName: 'assets/theme.js', chunk: { ...chunk, imports: ['react'] } })).toThrow(/self-contained/i);
  const foreign = mkdtempSync(join(tmpdir(), 'niubu-foreign-'));
  try {
    const file = join(foreign, 'unsealed.js'); writeFileSync(file, 'export const value=1;');
    expect(() => register!({ entry, fileName: 'assets/theme.js', chunk: { ...chunk, moduleIds: [entry, file] } })).toThrow(/canonical inputs/i);
  } finally { rmSync(foreign, { recursive: true, force: true }); }
});
it('emits a single self-contained classic IIFE before final stylesheet and module tags under a non-root base', async () => {
  const theme = plugin();
  const root = mkdtempSync(join(tmpdir(), 'niubu-theme-'));
  try {
    writeFileSync(join(root, 'vite.config.ts'), "throw Error('nested config must never load');");
    writeFileSync(join(root, 'index.html'), '<html><head></head><body><script type="module" src="/main.js"></script></body></html>');
    writeFileSync(join(root, 'main.js'), "import './style.css'; document.body.dataset.app = 'ready';");
    writeFileSync(join(root, 'style.css'), 'body { color: #123456; }');
    const result = await build({ configFile: false, root, resolve: { alias: fixtureAliases }, base: '/nested/', logLevel: 'silent', plugins: [theme], build: { write: false } });
    const built = Array.isArray(result) ? result[0] : result;
    if (!('output' in built)) throw Error('Unexpected watcher');
    const output = built.output;
    const html = output.find(item => item.type === 'asset' && item.fileName === 'index.html');
    expect(html?.type).toBe('asset');
    const text = String((html as { source: string }).source);
    const classic = [...text.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].find(match => !/type="module"/.test(match[0]));
    expect(classic).toBeDefined();
    expect(classic![0]).not.toMatch(/\b(?:type|async|defer)\b/);
    expect(classic![1]).toMatch(/^\/nested\/assets\/theme-init-[a-f0-9]+\.js$/);
    for (const other of text.matchAll(/<(?:script\b[^>]*type="module"|link\b[^>]*rel="stylesheet")[^>]*>/g)) expect(classic!.index).toBeLessThan(other.index!);
    const file = classic![1].slice('/nested/'.length);
    const script = output.find(item => item.fileName === file);
    expect(script?.type).toBe('asset');
    const code = String((script as { source: string }).source);
    expect(code).not.toMatch(/\bimport\s*(?:\(|[{"'])|\bexport\s/);
    expect(code).not.toMatch(/react|i18next|createPreferenceManager|createAppPreferenceManager/);
    const { dataset, styles, reads, writes, listeners } = evaluateTheme(code);
    expect(reads).toEqual([contract.hintedKey]);
    expect(dataset).toEqual({ theme: 'dark', density: 'compact', themePreset: 'default', grayscale: 'false', colorWeak: 'false', semiDarkSidebar: 'false', semiDarkSubmenu: 'false', semiDarkHeader: 'false' });
    expect(styles.get('--primary')).toBe('#006be6');
    expect(styles.has('--row-height')).toBe(false);
    expect(writes).toBe(0); expect(listeners).toBe(0);
    for (const options of [
      { hint: null }, { hint: '{' }, { hint: JSON.stringify({ version: 2, identityKey: 'fixture-user' }) },
      { hint: JSON.stringify({ version: 1, identityKey: ' fixture-user' }) },
      { hint: JSON.stringify({ version: 1, identityKey: 'fixture-user', authenticated: true }), blocked: true },
      { missingSessionGetter: true },
    ]) {
      const fallback = evaluateTheme(code, options);
      expect(fallback.dataset).toEqual({ ...dataset, density: 'standard' });
      expect(fallback.reads).toEqual([contract.anonymousKey]);
      expect(fallback.writes).toBe(0); expect(fallback.listeners).toBe(0);
    }
    const unavailable = evaluateTheme(code, { unavailableStorage: true });
    expect(unavailable.dataset).toEqual({ ...dataset, density: 'standard' });
    expect(unavailable.writes).toBe(0); expect(unavailable.listeners).toBe(0);

  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('serves the same IIFE using controlled dev middleware and puts it before existing head tags', async () => {
  const appId = 'fixture</script>"', environment = 'stage & preview';
  const theme = plugin({ appId, environment });
  const resolved = await resolveConfig({ configFile: false, root: fixtureRoot, resolve: { alias: fixtureAliases }, base: '/preview/', logLevel: 'silent' }, 'serve');
  const onResolved = theme.configResolved as (config: typeof resolved) => void;
  onResolved(resolved);
  let middleware: (req: { url: string }, res: unknown, next: () => void) => Promise<void>;
  await (theme.configureServer as (server: unknown) => unknown)({ middlewares: { use: (fn: typeof middleware) => { middleware = fn; } } });
  const transform = theme.transformIndexHtml as { handler: (html: string) => Promise<string> };
  const html = await transform.handler('<html><head><link rel="stylesheet" href="/a.css"><script type="module" src="/main.ts"></script></head></html>');
  const src = html.match(/<script src="([^"]+)"/)![1];
  expect(src).toBe(`/preview/@niubu/theme-init/${encodeURIComponent(appId)}/${encodeURIComponent(environment)}.js`);
  expect(() => assertThemeInitHead(html, src)).not.toThrow();
  expect(html.indexOf(`<script src="${src}"`)).toBeLessThan(html.indexOf('rel="stylesheet"'));
  let body = '', contentType = '', next = 0;
  await middleware!({ url: src + '?v=1' }, { setHeader: (name: string, value: string) => { if (name === 'Content-Type') contentType = value; }, end: (value: string) => { body = value; } }, () => { next++; });
  expect(contentType).toContain('javascript'); expect(next).toBe(0);
  const evaluated = evaluateTheme(body);
  expect(evaluated.dataset).toEqual({ theme: 'dark', density: 'compact', themePreset: 'default', grayscale: 'false', colorWeak: 'false', semiDarkSidebar: 'false', semiDarkSubmenu: 'false', semiDarkHeader: 'false' });
  expect(evaluated.reads).toEqual([contract.hintedKey]);
  expect(evaluated.styles.get('--primary')).toBe('#006be6');
  expect(evaluated.styles.has('--row-height')).toBe(false);
  expect(evaluated.writes).toBe(0); expect(evaluated.listeners).toBe(0);
  await middleware!({ url: '/unrelated' }, {}, () => { next++; }); expect(next).toBe(1);
});
it('checks the real source closure before tree shaking for forbidden runtime and business dependencies', () => {
  const graph = readWorkspace(workspaceRoot), seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return; seen.add(file);
    expect(file).not.toMatch(/node_modules|\/locales\/|\/domains\/|\/router\/|\/react(?:-context)?\./);
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function inspect(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly) return;
        const specifier = node.moduleSpecifier.text;
        expect(specifier).not.toMatch(/react|i18next|\/preferences$|\/hooks$/);
        if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier + (extname(specifier) ? '' : '.ts')));
        else {
          const imported = resolveWorkspaceImport(graph, file, specifier);
          expect(imported.kind).toBe('workspace');
          if (imported.kind === 'workspace') { expect(imported.isPublic).toBe(true); visit(imported.file); }
        }
      }
      ts.forEachChild(node, inspect);
    }
    inspect(ast);
  }
  visit(entry);
  expect([...seen]).not.toContain(resolve(workspaceRoot, 'packages/preferences/src/manager.ts'));
  expect([...seen].every(file => !file.startsWith(resolve(workspaceRoot, 'apps') + '/'))).toBe(true);
});
