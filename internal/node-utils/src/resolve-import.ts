import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { WorkspaceGraph, WorkspacePackage } from './workspace.ts';

export type ResolvedImport =
  | { kind: 'workspace'; owner: string; file: string; isPublic: boolean }
  | { kind: 'external'; name: string }
  | { kind: 'unresolved'; reason: string };
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json'];
export function contains(root: string, file: string): boolean {
  const path = relative(root, file);
  return path === '' || (path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path));
}
export function workspaceOwner(graph: WorkspaceGraph, file: string): WorkspacePackage | undefined {
  const absolute = existsSync(file) ? realpathSync(file) : resolve(file);
  return [...graph.packages.values()]
    .sort((a, b) => b.root.length - a.root.length)
    .find(pkg => contains(pkg.root, absolute));
}
function existingFile(path: string): string | undefined {
  const candidates = [
    path,
    ...extensions.map(ext => path + ext),
    ...extensions.map(ext => resolve(path, `index${ext}`)),
  ];
  if (/\.[cm]?jsx?$/.test(path))
    candidates.push(path.replace(/\.[cm]?jsx?$/, '.ts'), path.replace(/\.[cm]?jsx?$/, '.tsx'));
  const file = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
  return file && realpathSync(file);
}
function exportedTargets(pkg: WorkspacePackage, subpath: string): string[] {
  const exact = pkg.explicitExports.get(subpath);
  if (exact) return [...exact];
  // Select one export key before inspecting its targets. A more specific
  // empty/null entry must block a broader public wildcard, independent of order.
  const patterns = [...pkg.explicitExports]
    .filter(([key]) => {
      if (!key.includes('*')) return false;
      const [prefix, suffix] = key.split('*');
      return subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length;
    })
    .sort(([a], [b]) => b.indexOf('*') - a.indexOf('*') || b.length - a.length);
  const selected = patterns[0];
  if (selected) {
    const [key, targets] = selected;
    const [prefix, suffix] = key.split('*');
    const star = subpath.slice(prefix.length, suffix ? -suffix.length : undefined);
    return targets.map(target => target.replaceAll('*', star));
  }
  return [];
}
function publicFile(pkg: WorkspacePackage, file: string): boolean {
  return [...pkg.explicitExports].some(([key, targets]) =>
    targets.some(target => {
      if (!target.startsWith('./')) return false;
      if (!key.includes('*')) return existingFile(resolve(pkg.root, target)) === file;
      const [prefix, suffix] = resolve(pkg.root, target).split('*');
      return file.startsWith(prefix) && file.endsWith(suffix);
    }),
  );
}
export function resolveWorkspaceImport(graph: WorkspaceGraph, fromFile: string, raw: string): ResolvedImport {
  const specifier = raw.split(/[?#]/, 1)[0];
  const from = workspaceOwner(graph, fromFile);
  const local =
    specifier.startsWith('@/') || specifier.startsWith('/src/')
      ? from && resolve(from.sourceRoots[0], specifier.replace(/^(?:@\/|\/src\/)/, ''))
      : specifier.startsWith('.') || isAbsolute(specifier)
        ? resolve(dirname(fromFile), specifier)
        : undefined;
  if (local) {
    const file = existingFile(local);
    if (!file) return { kind: 'unresolved', reason: `Local import does not resolve: ${specifier}` };
    const owner = workspaceOwner(graph, file);
    return owner
      ? {
          kind: 'workspace',
          owner: owner.name,
          file,
          isPublic: from?.name === owner.name && contains(owner.root, file) && publicFile(owner, file),
        }
      : { kind: 'unresolved', reason: `Local import escapes workspace: ${specifier}` };
  }
  const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  const pkg = graph.packages.get(name);
  if (!pkg) return { kind: 'external', name };
  const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
  if (
    subpath !== '.' &&
    subpath
      .slice(2)
      .split('/')
      .some(segment => ['.', '..', 'node_modules'].includes(segment))
  )
    return { kind: 'unresolved', reason: `Invalid workspace export subpath: ${specifier}` };
  const exported = exportedTargets(pkg, subpath)
    .filter(target => target.startsWith('./'))
    .map(target => existingFile(resolve(pkg.root, target)))
    .find(Boolean);
  const file = exported ?? existingFile(resolve(pkg.root, specifier.slice(name.length + 1)));
  if (!file) return { kind: 'unresolved', reason: `Workspace entry does not resolve: ${specifier}` };
  const owner = workspaceOwner(graph, file);
  if (!owner) return { kind: 'unresolved', reason: `Workspace export escapes workspace: ${specifier}` };
  return {
    kind: 'workspace',
    owner: owner.name,
    file,
    isPublic: Boolean(exported) && owner.name === pkg.name && contains(pkg.root, file),
  };
}
