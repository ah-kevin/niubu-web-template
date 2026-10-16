import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { contains } from './resolve-import.ts';
import type { WorkspaceGraph, WorkspacePackage } from './workspace.ts';

export const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const ignored = [
  '**/node_modules/**',
  '**/.git/**',
  'dist/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.vite/**',
  '**/.vite-temp/**',
  '**/.pnpm-store/**',
  '**/.superpowers/**',
  '**/.verification-private/**',
  '**/playwright-report/**',
  '**/test-results/**',
];
const normalize = (file: string) => file.replaceAll('\\', '/');
const runtimeEdges = (pkg: WorkspacePackage) =>
  Object.keys({ ...pkg.manifest.dependencies, ...pkg.manifest.peerDependencies, ...pkg.manifest.optionalDependencies });

export function readBuildInputs(graph: WorkspaceGraph, appName: string) {
  const app = graph.packages.get(appName);
  if (!app) throw Error(`Build input app workspace is missing: ${appName}`);
  const runtime = new Set<string>();
  function visitRuntime(name: string) {
    if (runtime.has(name)) return;
    const pkg = graph.packages.get(name);
    if (!pkg) return;
    runtime.add(name);
    runtimeEdges(pkg).forEach(visitRuntime);
  }
  visitRuntime(appName);
  // Tooling is distinct from the browser runtime graph. Include configured
  // internal tools and declared build-time workspace dependencies, recursively.
  const tools = new Set<string>();
  function visitTool(name: string) {
    if (tools.has(name) || !graph.packages.has(name)) return;
    tools.add(name);
    const pkg = graph.packages.get(name)!;
    [...pkg.dependencies].forEach(visitTool);
  }
  for (const pkg of graph.packages.values()) {
    if (normalize(relative(graph.root, pkg.root)).startsWith('internal/')) visitTool(pkg.name);
    if (runtime.has(pkg.name) || pkg.root === graph.root)
      Object.keys(pkg.manifest.devDependencies ?? {}).forEach(visitTool);
  }
  const files = new Set<string>();
  function add(file: string) {
    if (!existsSync(file) || !statSync(file).isFile()) return;
    const actual = realpathSync(file);
    if (!contains(graph.root, actual)) throw Error(`Build input escapes workspace: ${file}`);
    files.add(actual);
  }
  const patterns = [
    'src/**',
    'public/**',
    'scripts/**',
    'tools/**',
    'package.json',
    'index.html',
    'tsconfig*.json',
    '*.config.*',
    'turbo.json',
    '.env*',
    '*.mjs',
    '*.cjs',
    '*.js',
    '*.ts',
  ];
  for (const name of new Set([...runtime, ...tools])) {
    const pkg = graph.packages.get(name)!;
    for (const file of globSync(patterns, { cwd: pkg.root, exclude: ignored })) add(resolve(pkg.root, file));
    for (const targets of pkg.explicitExports.values())
      for (const target of targets) {
        if (target.includes('*') || !target.startsWith('./'))
          throw Error(`Build input requires an explicit source export: ${name} ${target}`);
        if (!existsSync(resolve(pkg.root, target)))
          throw Error(`Build input source export is missing: ${name} ${target}`);
        add(resolve(pkg.root, target));
      }
    // Source-only tools such as tsconfig expose canonical JSON at their root.
    if (tools.has(name))
      for (const file of globSync(['*.json', 'check.*'], { cwd: pkg.root, exclude: ignored }))
        add(resolve(pkg.root, file));
  }
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
    if (!existsSync(join(graph.root, file))) throw Error(`Required build input is missing: ${file}`);
  for (const file of globSync(
    [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      'tsconfig*.json',
      '*.config.*',
      '.prettierrc.*',
      '.prettierignore',
      '.npmrc',
      '.env*',
      'scripts/**',
      'tools/**',
    ],
    { cwd: graph.root, exclude: ignored },
  ))
    add(join(graph.root, file));
  const inputs = [...files]
    .map(file => ({ file: normalize(relative(graph.root, file)), sha256: sha256(readFileSync(file)) }))
    .sort((a, b) => a.file.localeCompare(b.file));
  const environment = Object.fromEntries(
    [...new Set(['NODE_ENV', ...Object.keys(process.env).filter(name => name.startsWith('VITE_'))])]
      .sort()
      .map(name => [name, sha256(process.env[name] ?? (name === 'NODE_ENV' ? 'production' : ''))]),
  );
  const snapshot = {
    schemaVersion: 1,
    appName,
    runtimePackages: [...runtime].sort(),
    toolPackages: [...tools].filter(name => !runtime.has(name)).sort(),
    inputs,
    environment,
    toolchain: { node: process.version, zlib: process.versions.zlib },
  };
  return { ...snapshot, inputHash: sha256(JSON.stringify(snapshot)) };
}

export function hashBuildInputs(graph: WorkspaceGraph, appName: string): string {
  return readBuildInputs(graph, appName).inputHash;
}
