import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

/** Public foundations and the Playground reference must match the template; guides listed here are byte-identical. */
const syncedPrefixes = ['packages/', 'internal/', 'scripts/', 'apps/playground/'];
const syncedFiles = ['docs/guide/standards.md', 'docs/guide/workflow.md'];
const divergenceFile = 'template-divergence.json';

export function inSyncScope(path: string): boolean {
  return syncedPrefixes.some(prefix => path.startsWith(prefix)) || syncedFiles.includes(path);
}
const matches = (path: string, declaration: string) =>
  declaration.endsWith('/') ? path.startsWith(declaration) : path === declaration;

export type TreeComparison = Readonly<{
  same: number;
  different: readonly string[];
  onlyLocal: readonly string[];
  onlyTemplate: readonly string[];
  /** Differences covered by a declared divergence. */
  accepted: readonly string[];
  unaccepted: number;
  /** Declarations that no longer match any difference and should be removed. */
  stale: readonly string[];
}>;
/** Trees map a repository-relative path to its content hash. A declaration is an exact path or a directory prefix. */
export function compareTrees(
  local: ReadonlyMap<string, string>,
  template: ReadonlyMap<string, string>,
  declarations: readonly string[],
): TreeComparison {
  const paths = [...new Set([...local.keys(), ...template.keys()])].sort();
  const different: string[] = [];
  const onlyLocal: string[] = [];
  const onlyTemplate: string[] = [];
  let same = 0;
  for (const path of paths) {
    const here = local.get(path);
    const there = template.get(path);
    if (here !== undefined && there !== undefined) {
      if (here === there) same++;
      else different.push(path);
    } else if (here !== undefined) onlyLocal.push(path);
    else onlyTemplate.push(path);
  }
  const drift = [...different, ...onlyLocal, ...onlyTemplate].sort();
  const accepted = drift.filter(path => declarations.some(declaration => matches(path, declaration)));
  return {
    same,
    different,
    onlyLocal,
    onlyTemplate,
    accepted,
    unaccepted: drift.length - accepted.length,
    stale: declarations.filter(declaration => !drift.some(path => matches(path, declaration))),
  };
}

function readTree(root: string): Map<string, string> {
  const listing = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const tree = new Map<string, string>();
  for (const path of listing.toString().split('\0')) {
    if (!path || !inSyncScope(path) || !existsSync(resolve(root, path))) continue;
    tree.set(
      path,
      createHash('sha256')
        .update(readFileSync(resolve(root, path)))
        .digest('hex'),
    );
  }
  return tree;
}
function readDeclarations(root: string): string[] {
  const file = resolve(root, divergenceFile);
  if (!existsSync(file)) return [];
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const accepted = (value as { accepted?: unknown }).accepted;
  if (
    !Array.isArray(accepted) ||
    accepted.some(entry => typeof entry?.path !== 'string' || typeof entry?.reason !== 'string' || !entry.reason)
  )
    throw Error(`${divergenceFile} must list { path, reason } entries`);
  return accepted.map(entry => entry.path);
}

/** Compares this repository's shared foundations with the template checkout. Exit code 1 means unexplained drift. */
export function runTemplateSync(root: string, templateRoot: string, write: (line: string) => void): number {
  if (!existsSync(resolve(templateRoot, '.git'))) throw Error(`Template checkout not found: ${templateRoot}`);
  const result = compareTrees(readTree(root), readTree(templateRoot), readDeclarations(root));
  const section = (title: string, paths: readonly string[]) => {
    if (!paths.length) return;
    write(`${title} (${paths.length})`);
    for (const path of paths) write(`  ${result.accepted.includes(path) ? '[accepted] ' : ''}${path}`);
  };
  section('Differs from template', result.different);
  section('Only in this repository', result.onlyLocal);
  section('Only in template', result.onlyTemplate);
  if (result.stale.length) {
    write(`Stale divergence declarations (${result.stale.length})`);
    for (const declaration of result.stale) write(`  ${declaration}`);
  }
  write(
    `${result.same} identical, ${result.accepted.length} accepted divergences, ${result.unaccepted} unexplained differences`,
  );
  return result.unaccepted || result.stale.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { template: { type: 'string' } } });
  const root = process.cwd();
  const template = values.template ?? process.env.NIUBU_TEMPLATE_PATH;
  if (!template) throw Error('Pass --template <path> or set NIUBU_TEMPLATE_PATH to the template checkout');
  const templateRoot = resolve(template);
  process.exitCode = runTemplateSync(root, templateRoot, line => console.log(line));
}
