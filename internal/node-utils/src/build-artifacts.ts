import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { BuildContextSnapshot } from './build-context.ts';
import { contains } from './resolve-import.ts';
import type { RuntimeConfigDescriptor } from '@niubu/core-shared/runtime-config';

export interface InitialHtml {
  entries: string[];
  preloads: string[];
  classicScripts: string[];
  stylesheets: string[];
}
export interface FirstScreenRoots {
  schemaVersion: 1;
  appName: string;
  inputHash: string;
  base: string;
  contextHash: string;
  html: InitialHtml;
  modules: Record<string, { source: string; files: string[] }>;
  variants: Record<string, { requiredModules: string[]; roots: string[] }>;
  themeInit?: { source: string; file: string; sha256: string; modules: string[] };
}
export interface BuildProvenance {
  schemaVersion: 1;
  appName: string;
  inputHash: string;
  artifacts: Record<string, string>;
  buildContext: BuildContextSnapshot;
  runtimeConfig?: { file: '_app.config.js'; schemaVersion: 1; generatedSha256: string };
}
export interface BuildProvenanceApi {
  finalize(): void;
  getRuntimeConfig(): RuntimeConfigDescriptor | undefined;
  /** Only the explicitly configured theme entry can use this separate IIFE mapping. */
  registerThemeInitIife(evidence: ThemeInitIifeEvidence): void;
}
export interface ThemeInitIifeEvidence {
  entry: string;
  fileName: string;
  chunk: {
    code: string;
    facadeModuleId: string | null;
    moduleIds: string[];
    imports: string[];
    dynamicImports: string[];
    isEntry: boolean;
  };
}

export function artifactPath(dist: string, file: string): string {
  if (
    !file ||
    file.startsWith('/') ||
    file.includes('\\') ||
    /[?#:]/.test(file) ||
    posix.normalize(file) !== file ||
    file === '..' ||
    file.startsWith('../')
  )
    throw Error(`Unsafe emitted artifact path: ${file}`);
  const actual = join(dist, file);
  if (existsSync(actual) && !contains(realpathSync(dist), realpathSync(actual)))
    throw Error(`Emitted artifact escapes dist: ${file}`);
  return actual;
}
export function artifactFiles(dist: string): string[] {
  const files: string[] = [];
  function visit(directory: string) {
    for (const entry of readdirSync(join(dist, directory), { withFileTypes: true })) {
      const file = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw Error(`Symlink emitted artifact is forbidden: ${file}`);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  visit('');
  return files.sort();
}
export function initialHtml(html: string, base = '/'): InitialHtml {
  const result: InitialHtml = { entries: [], preloads: [], classicScripts: [], stylesheets: [] };
  const asset = (value: string) => {
    if (base !== '/' && value.startsWith(base)) value = value.slice(base.length);
    else if (base === '/' && value.startsWith('/') && !value.startsWith('//')) value = value.slice(1);
    if (value.startsWith('./')) value = value.slice(2);
    artifactPath('.', value);
    return value;
  };
  for (const tag of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const attributes = Object.fromEntries(
      [...tag[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=]+)))?/g)].map(match => [
        match[1].toLowerCase(),
        match[2] ?? match[3] ?? match[4] ?? '',
      ]),
    );
    if (tag[1].toLowerCase() === 'script' && attributes.src) {
      const field = attributes.type?.toLowerCase() === 'module' ? 'entries' : 'classicScripts';
      result[field].push(asset(attributes.src));
    } else if (tag[1].toLowerCase() === 'link' && attributes.href) {
      const rel = attributes.rel?.toLowerCase().split(/\s+/) ?? [];
      if (rel.includes('modulepreload')) result.preloads.push(asset(attributes.href));
      if (rel.includes('stylesheet')) result.stylesheets.push(asset(attributes.href));
    }
  }
  for (const key of Object.keys(result) as (keyof InitialHtml)[]) result[key] = [...new Set(result[key])].sort();
  if (!result.entries.length) throw Error('Missing real HTML entry root');
  return result;
}
