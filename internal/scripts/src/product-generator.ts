import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readdirSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
  mkdtempSync,
  renameSync,
  rmdirSync,
} from 'node:fs';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import {
  outputPath,
  productAppPath,
  sourcePublicScope,
  transformProductFile,
  type ProductIdentity,
} from './product-transform.ts';

export type ProductInput = Readonly<{
  sourceRoot: string;
  targetDir: string;
  productSlug: string;
  displayNameZh: string;
  displayNameEn: string;
  packageName?: string;
  defaultLocale?: string;
  publicScope?: string;
  templateRef?: string;
}>;
export type ProductFile = Readonly<{ path: string; content: Buffer; mode: number }>;
export type ProductPlan = Readonly<{
  sourceRoot: string;
  targetDir: string;
  files: readonly ProductFile[];
  manifest: Readonly<Record<string, unknown>>;
}>;
const hasControl = (value: string) => [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const digest = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
const rootFiles = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'turbo.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'eslint.config.js',
  '.prettierrc.js',
  '.prettierignore',
  '.gitignore',
  '.dockerignore',
  '.npmrc',
  '.nvmrc',
  '.node-version',
  'Dockerfile',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'LICENSE',
  'LICENSE.md',
  'boundary.config.json',
  'commitlint.config.js',
]);
const allowedRoots = [
  'packages/',
  'internal/',
  'scripts/',
  'tests/integration/',
  'apps/starter/',
  'apps/playground/',
  'apps/backend-mock/',
  'docs/guide/',
  '.github/',
];
function allowed(path: string) {
  const parts = path.split('/');
  return (
    !parts.some(
      part =>
        ['node_modules', 'dist', '.git', '.turbo', '.superpowers', '.pnpm-store', '.output', '.nitro'].includes(part) ||
        (part.startsWith('.env') && part !== '.env.example'),
    ) &&
    (rootFiles.has(path) || allowedRoots.some(root => path.startsWith(root)))
  );
}
function validateTarget(source: string, target: string): void {
  const relation = relative(source, target);
  if (!relation || (!relation.startsWith('..' + '/') && relation !== '..' && !isAbsolute(relation)))
    throw new Error('Target must be outside source repository');
  for (let current = target; ; current = dirname(current)) {
    if (
      existsSync(current) ||
      (() => {
        try {
          lstatSync(current);
          return true;
        } catch {
          return false;
        }
      })()
    ) {
      if (lstatSync(current).isSymbolicLink()) throw new Error('Target has a symbolic link component');
      if (!lstatSync(current).isDirectory()) throw new Error('Target is not a directory');
    }
    if (dirname(current) === current) break;
  }
  if (existsSync(target) && readdirSync(target).length) throw new Error('Target must be empty');
  if (!existsSync(dirname(target))) throw new Error('Target parent must exist');
  const ancestor = relative(target, source);
  if (!ancestor || (!ancestor.startsWith('..' + '/') && ancestor !== '..' && !isAbsolute(ancestor)))
    throw new Error('Target cannot contain source repository');
}
function git(root: string, args: string[], input?: string): Buffer {
  return execFileSync('git', args, { cwd: root, input, maxBuffer: 256 * 1024 * 1024 });
}

export function planProduct(input: ProductInput): ProductPlan {
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.productSlug) ||
    input.productSlug.length > 60 ||
    ['starter', 'playground'].includes(input.productSlug)
  )
    throw new Error('Invalid or reserved product slug');
  const publicScope = input.publicScope ?? sourcePublicScope;
  if (!/^@[a-z][a-z0-9-]{0,59}$/.test(publicScope) || publicScope === '@niubu-internal')
    throw new Error('Invalid or conflicting public scope');
  const packageName = input.packageName ?? input.productSlug + '-web';
  if (!/^[a-z][a-z0-9-]{0,100}$/.test(packageName)) throw new Error('Invalid root package name');
  for (const name of [input.displayNameZh, input.displayNameEn])
    if (typeof name !== 'string' || !name.trim() || name.length > 120 || hasControl(name))
      throw new Error('Invalid product display name');
  const defaultLocale = input.defaultLocale ?? 'zh-CN';
  if (defaultLocale !== 'zh-CN' && defaultLocale !== 'en-US') throw new Error('Unknown default locale');
  const sourceRoot = realpathSync(input.sourceRoot),
    targetDir = resolve(input.targetDir);
  validateTarget(sourceRoot, targetDir);
  const ref = input.templateRef ?? 'HEAD';
  if (ref.startsWith('-') || [...ref].some(char => char.charCodeAt(0) <= 32))
    throw new Error('Invalid template reference');
  const commit = git(sourceRoot, ['rev-parse', '--verify', ref + '^{commit}'])
    .toString()
    .trim();
  const sourceTime = git(sourceRoot, ['show', '-s', '--format=%cI', commit]).toString().trim();
  const tree = git(sourceRoot, ['ls-tree', '-r', '-z', commit])
    .toString()
    .split('\0')
    .filter(Boolean)
    .map(line => {
      const tab = line.indexOf('\t'),
        [mode, type, oid] = line.slice(0, tab).split(' ');
      return { mode, type, oid, path: line.slice(tab + 1) };
    })
    .filter(entry => allowed(entry.path));
  for (const entry of tree)
    if (
      !['100644', '100755'].includes(entry.mode) ||
      entry.type !== 'blob' ||
      entry.path.split('/').some(part => part === '..' || part === '.' || part.includes('\\') || hasControl(part))
    )
      throw new Error(`Unsupported committed file: ${entry.path}`);
  if (!tree.some(entry => entry.path === 'apps/starter/package.json'))
    throw new Error('Source commit does not contain an admin starter');
  const batch = git(sourceRoot, ['cat-file', '--batch'], tree.map(entry => entry.oid).join('\n') + '\n');
  let offset = 0;
  const blobs = tree.map(entry => {
    const end = batch.indexOf(10, offset);
    if (end < 0) throw new Error('Incomplete Git blob response');
    const header = batch.subarray(offset, end).toString().split(' '),
      size = Number(header[2]);
    if (header[0] !== entry.oid || !Number.isSafeInteger(size) || size < 0 || size > 8 * 1024 * 1024)
      throw new Error('Unsupported Git blob');
    offset = end + 1;
    const content = batch.subarray(offset, offset + size);
    offset += size + 1;
    return { ...entry, content };
  });
  const sourceManifest = JSON.parse(blobs.find(file => file.path === 'package.json')!.content.toString());
  const identity: ProductIdentity = {
    productSlug: input.productSlug,
    displayNameZh: input.displayNameZh,
    displayNameEn: input.displayNameEn,
    packageName,
    publicScope,
    defaultLocale,
  };
  const files: ProductFile[] = blobs
    .map(file => ({
      path: outputPath(file.path),
      mode: file.mode === '100755' ? 0o755 : 0o644,
      content: transformProductFile(file.path, file.content, identity, sourceManifest.name),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const names = new Set<string>();
  for (const file of files.filter(file => file.path.endsWith('/package.json') || file.path === 'package.json')) {
    const manifest = JSON.parse(file.content.toString());
    if (!manifest.name || names.has(manifest.name)) throw new Error('Duplicate or missing package name');
    names.add(manifest.name);
  }
  for (const file of files.filter(file => file.path.endsWith('/package.json') || file.path === 'package.json')) {
    const manifest = JSON.parse(file.content.toString());
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])
      for (const [name, version] of Object.entries(manifest[field] ?? {}))
        if (typeof version === 'string' && version.startsWith('workspace:') && !names.has(name))
          throw new Error(`Unresolved workspace dependency: ${name}`);
  }
  if (!names.has(publicScope + '/web') || files.some(file => file.path.startsWith('apps/starter/')))
    throw new Error('Incomplete starter mapping');
  // This source receipt is deliberately separate from build-app's runtime build provenance.
  const manifest = {
    schemaVersion: 1,
    generatorVersion: 1,
    templateCommit: commit,
    templateTime: sourceTime,
    sourcePublicScope,
    targetPublicScope: publicScope,
    sourceInternalScope: '@niubu-internal',
    targetInternalScope: '@niubu-internal',
    profile: 'admin-mock',
    identity,
    inputHash: digest(JSON.stringify(identity)),
    productApp: productAppPath,
    files: files.map(file => ({ path: file.path, sha256: digest(file.content), mode: file.mode })),
  };
  return { sourceRoot, targetDir, files, manifest };
}

export function applyProduct(plan: ProductPlan): void {
  validateTarget(plan.sourceRoot, plan.targetDir);
  const expected = plan.manifest.files as readonly { path: string; sha256: string; mode: number }[];
  if (!Array.isArray(expected) || expected.length !== plan.files.length) throw new Error('Invalid file manifest');
  for (const [index, file] of plan.files.entries()) {
    const record = expected[index];
    if (
      !record ||
      record.path !== file.path ||
      record.mode !== file.mode ||
      record.sha256 !== digest(file.content) ||
      isAbsolute(file.path) ||
      file.path.split(/[\\/]/).some(part => !part || part === '..' || part === '.')
    )
      throw new Error('Product file checksum or manifest changed');
  }
  const staging = mkdtempSync(join(dirname(plan.targetDir), '.product-staging-'));
  try {
    for (const file of plan.files) {
      const destination = join(staging, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.content, { flag: 'wx' });
      chmodSync(destination, file.mode);
    }
    writeFileSync(join(staging, '.template-source.json'), JSON.stringify(plan.manifest, null, 2) + '\n', {
      flag: 'wx',
    });
    validateTarget(plan.sourceRoot, plan.targetDir);
    if (existsSync(plan.targetDir)) rmdirSync(plan.targetDir);
    renameSync(staging, plan.targetDir);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
