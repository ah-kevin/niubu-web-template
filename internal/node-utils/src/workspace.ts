import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface WorkspaceManifest {
  name: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  [key: string]: unknown;
}
export interface WorkspacePackage {
  name: string;
  root: string;
  manifest: WorkspaceManifest;
  explicitExports: ReadonlyMap<string, readonly string[]>;
  dependencies: ReadonlySet<string>;
  sourceRoots: readonly string[];
}
export interface WorkspaceGraph {
  root: string;
  packages: ReadonlyMap<string, WorkspacePackage>;
}
const targets = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(targets);
  if (value && typeof value === 'object') return Object.values(value).flatMap(targets);
  return [];
};
function exportsMap(value: unknown): Map<string, readonly string[]> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).some(key => key.startsWith('.'))
  ) {
    return new Map(Object.entries(value).map(([key, value]) => [key, targets(value)]));
  }
  return new Map(value === undefined ? [] : [['.', targets(value)]]);
}

/** Reads pnpm's package globs without introducing a runtime YAML dependency. */
export function readWorkspace(root: string): WorkspaceGraph {
  root = realpathSync(root);
  const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as WorkspaceManifest;
  const workspaceFile = join(root, 'pnpm-workspace.yaml');
  const configured = rootManifest.workspaces;
  let patterns = Array.isArray(configured) ? configured : (configured?.packages ?? []);
  if (existsSync(workspaceFile)) {
    const yaml = readFileSync(workspaceFile, 'utf8');
    const block = /^packages:\s*\n((?:[ \t]+.*\n?)*)/m.exec(yaml)?.[1] ?? '';
    patterns = [...block.matchAll(/^\s*-\s*['"]?([^'"\n#]+?)['"]?\s*(?:#.*)?$/gm)].map(match => match[1].trim());
  }
  const included = patterns.filter(pattern => !pattern.startsWith('!'));
  const excluded = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1));
  const discoveredRoots = included.length
    ? globSync(
        included.map(pattern => `${pattern.replace(/\/$/, '')}/package.json`),
        { cwd: root, exclude: excluded.map(pattern => `${pattern}/**`) },
      ).map(file => dirname(resolve(root, file)))
    : [];
  // pnpm's root is an importer even when package globs are configured. Keep
  // legacy source governed; nested workspace roots still win owner lookup.
  const roots = [...new Set([root, ...discoveredRoots].map(packageRoot => realpathSync(packageRoot)))];
  const packages = new Map<string, WorkspacePackage>();
  for (const packageRoot of roots) {
    const realRoot = realpathSync(packageRoot);
    const manifest = JSON.parse(readFileSync(join(realRoot, 'package.json'), 'utf8')) as WorkspaceManifest;
    if (!manifest.name) throw new Error(`Workspace manifest has no name: ${realRoot}`);
    if (packages.has(manifest.name)) throw new Error(`Duplicate workspace name: ${manifest.name}`);
    packages.set(manifest.name, {
      name: manifest.name,
      root: realRoot,
      manifest,
      explicitExports: exportsMap(manifest.exports),
      dependencies: new Set(
        Object.keys({
          ...manifest.dependencies,
          ...manifest.devDependencies,
          ...manifest.peerDependencies,
          ...manifest.optionalDependencies,
        }),
      ),
      sourceRoots: [join(realRoot, 'src')],
    });
  }
  return { root, packages };
}
