import ts from 'typescript';
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { discoverFrontendApps, selectFrontendApp } from './frontend-apps.ts';

const locales = ['zh-CN', 'en-US'];
const publicNamespaces = new Set(['common', 'validation', 'shell']);
const parameters = (text: string) =>
  [...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(match => match[1]))].sort();
/** Map identity is owner/locale/namespace, e.g. public/zh-CN/common or app/en-US/app.
 * Keys are flat i18next keys; repeated slots and slot order do not change the parameter set. */
export type LocaleBinding = Readonly<{
  namespace: string;
  key: string;
  parameters: readonly string[];
  location: string;
}>;
export function checkLocales(
  catalogs: ReadonlyMap<string, Record<string, string>>,
  options: { bindings?: readonly LocaleBinding[] } = {},
): { errors: readonly string[] } {
  const errors: string[] = [];
  const groups = new Map<string, Map<string, Record<string, string>>>();
  for (const [identity, catalog] of catalogs) {
    const match = /^(public|app)\/(zh-CN|en-US)\/([\w.-]+)$/.exec(identity);
    if (!match) {
      errors.push(`Invalid catalog identity: ${identity}`);
      continue;
    }
    const [, owner, locale, namespace] = match;
    if (owner === 'app' && publicNamespaces.has(namespace))
      errors.push(`App cannot override public namespace: ${identity}`);
    if (owner === 'public' && !publicNamespaces.has(namespace)) errors.push(`Unknown public namespace: ${identity}`);
    if (
      !catalog ||
      typeof catalog !== 'object' ||
      Array.isArray(catalog) ||
      Object.values(catalog).some(value => typeof value !== 'string')
    ) {
      errors.push(`Catalog must contain flat string values: ${identity}`);
      continue;
    }
    const group = `${owner}/${namespace}`;
    const pair = groups.get(group) ?? new Map<string, Record<string, string>>();
    pair.set(locale, catalog);
    groups.set(group, pair);
  }
  for (const [group, pair] of groups) {
    for (const locale of locales) if (!pair.has(locale)) errors.push(`Missing language catalog: ${group}/${locale}`);
    const zh = pair.get('zh-CN'),
      en = pair.get('en-US');
    if (!zh || !en) continue;
    for (const key of new Set([...Object.keys(zh), ...Object.keys(en)])) {
      if (!Object.hasOwn(zh, key) || !Object.hasOwn(en, key)) errors.push(`Key parity differs: ${group}:${key}`);
      else if (JSON.stringify(parameters(zh[key])) !== JSON.stringify(parameters(en[key])))
        errors.push(`Interpolation parameters differ: ${group}:${key}`);
    }
  }
  for (const binding of options.bindings ?? []) {
    const catalog = catalogs.get(`app/zh-CN/${binding.namespace}`);
    if (!catalog || !Object.hasOwn(catalog, binding.key)) {
      errors.push(`Missing bound key: ${binding.location} ${binding.namespace}:${binding.key}`);
    } else if (
      JSON.stringify(parameters(catalog[binding.key])) !== JSON.stringify([...new Set(binding.parameters)].sort())
    ) {
      errors.push(`Bound interpolation parameters differ: ${binding.location} ${binding.namespace}:${binding.key}`);
    }
  }
  return { errors };
}
export function readLocaleCatalogs(
  root: string,
  options: { app?: string } = {},
): ReadonlyMap<string, Record<string, string>> {
  const app = selectFrontendApp(root, options.app);
  const catalogs = new Map<string, Record<string, string>>();
  const collect = (owner: string, path: string) => {
    for (const file of globSync('*/**/*.json', { cwd: resolve(root, path) })) {
      const [locale, ...rest] = file.split('/');
      const namespace = rest.join('.').replace(/\.json$/, '');
      const identity = `${owner}/${locale}/${namespace}`;
      if (catalogs.has(identity)) throw Error(`Duplicate locale catalog: ${identity}`);
      catalogs.set(identity, JSON.parse(readFileSync(resolve(root, path, file), 'utf8')) as Record<string, string>);
    }
  };
  collect('public', 'packages/locales/src/resources');
  collect('app', resolve(app.root, 'src/locales'));
  return catalogs;
}
/** Validate the app's explicit fixed-copy bindings. Dynamic controlled labels retain their own behavior checks. */
export function readAppLocaleBindings(root: string, options: { app?: string } = {}): readonly LocaleBinding[] {
  const app = selectFrontendApp(root, options.app);
  const result: LocaleBinding[] = [];
  for (const appFile of globSync('src/**/*.{ts,tsx}', { cwd: app.root })) {
    if (/\.(test|spec)\./.test(appFile) || /\/(?:tests?|__tests__|specs?|__specs__)\//.test(appFile)) continue;
    const file = relative(root, resolve(app.root, appFile)).replaceAll('\\', '/');
    const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const namespace = /\/domains\/([^/]+)\//.exec(file)?.[1] ?? 'app';
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'td' &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        const argument = node.arguments[1];
        const supplied =
          argument && ts.isObjectLiteralExpression(argument)
            ? argument.properties.flatMap(property => {
                if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
                  return [property.name.getText(source).replace(/^['"]|['"]$/g, '')];
                throw Error(`Uninspectable fixed-copy interpolation: ${file}`);
              })
            : [];
        result.push({
          namespace,
          key: node.arguments[0].text,
          parameters: supplied,
          location: `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return result;
}

/** App catalogs stay isolated even when two apps use the same namespace and key. */
export function checkWorkspaceLocales(root: string, options: { app?: string } = {}): { errors: readonly string[] } {
  const apps = options.app === undefined ? discoverFrontendApps(root) : [selectFrontendApp(root, options.app)];
  const errors: string[] = [];
  for (const app of apps) {
    try {
      const catalogs = readLocaleCatalogs(root, { app: app.name });
      if (![...catalogs.keys()].some(identity => identity.startsWith('app/')))
        errors.push(`${app.name}: No app locale catalogs found`);
      const bindings = readAppLocaleBindings(root, { app: app.name });
      errors.push(...checkLocales(catalogs, { bindings }).errors.map(error => `${app.name}: ${error}`));
    } catch (error) {
      errors.push(`${app.name}: ${String(error)}`);
    }
  }
  return { errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { app: { type: 'string' } } });
  const root = process.cwd();
  const result = checkWorkspaceLocales(root, values);
  if (result.errors.length) {
    result.errors.forEach(error => console.error(error));
    process.exitCode = 1;
  } else {
    const apps = values.app === undefined ? discoverFrontendApps(root) : [selectFrontendApp(root, values.app)];
    for (const app of apps)
      console.log(
        `${app.name}: Locale key and interpolation parity passed (${readLocaleCatalogs(root, { app: app.name }).size} catalogs, ${readAppLocaleBindings(root, { app: app.name }).length} fixed-copy bindings).`,
      );
  }
}
