import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export type BoundaryAllow = Readonly<{ path: string; term: string; reason: string }>;
export type BoundaryConfig = Readonly<{
  scan: readonly string[];
  exclude: readonly string[];
  words: readonly string[];
  literals: readonly string[];
  allow: readonly BoundaryAllow[];
}>;
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.md',
  '.html',
  '.yaml',
  '.yml',
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTextArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);

export function readBoundaryConfig(root: string): BoundaryConfig {
  const value: unknown = JSON.parse(readFileSync(join(root, 'boundary.config.json'), 'utf8'));
  if (
    !isRecord(value) ||
    !isTextArray(value.scan) ||
    !isTextArray(value.exclude) ||
    !isTextArray(value.words) ||
    !value.words.every(word => /^[a-z]+$/.test(word)) ||
    !isTextArray(value.literals) ||
    !Array.isArray(value.allow) ||
    !value.allow.every(entry => isRecord(entry) && isText(entry.path) && isText(entry.term) && isText(entry.reason))
  )
    throw new Error('Invalid boundary.config.json');
  return value as BoundaryConfig;
}

export function checkBoundary(root: string, config: BoundaryConfig): { errors: readonly string[] } {
  const hits: { path: string; line: number; term: string }[] = [];
  const patterns = config.words.map(word => {
    const title = word[0].toUpperCase() + word.slice(1);
    return new RegExp(
      `(?<![a-zA-Z])${word}(?![a-z])|(?<![A-Z])${title}(?![a-z])|(?<![A-Z])${word.toUpperCase()}(?![a-zA-Z])`,
      'g',
    );
  });
  const excluded = new Set(config.exclude);
  const visited = new Set<string>();
  function scan(directory: string) {
    if (!existsSync(directory) || visited.has(directory)) return;
    visited.add(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) scan(file);
      } else if (entry.isFile() && textExtensions.has(extname(entry.name))) {
        const path = relative(root, file).replaceAll('\\', '/');
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
          const matches: { index: number; term: string }[] = [];
          for (const pattern of patterns)
            for (const match of line.matchAll(pattern)) matches.push({ index: match.index, term: match[0] });
          for (const term of config.literals) {
            let offset = line.indexOf(term);
            while (offset !== -1) {
              matches.push({ index: offset, term });
              offset = line.indexOf(term, offset + term.length);
            }
          }
          for (const match of matches.sort((a, b) => a.index - b.index))
            hits.push({ path, line: index + 1, term: match.term });
        });
      }
    }
  }
  for (const directory of config.scan) {
    if (!directory.split(/[\\/]/).some(part => excluded.has(part))) scan(join(root, directory));
  }
  const used = new Set<BoundaryAllow>();
  const errors: string[] = [];
  for (const hit of hits) {
    const allowed = config.allow.filter(entry => entry.path === hit.path && entry.term === hit.term);
    if (allowed.length) allowed.forEach(entry => used.add(entry));
    else errors.push(`${hit.path}:${hit.line}: forbidden term "${hit.term}"`);
  }
  for (const entry of config.allow)
    if (!used.has(entry)) errors.push(`boundary allow entry no longer matches: ${entry.path} "${entry.term}"`);
  return { errors };
}
