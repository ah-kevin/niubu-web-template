import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { contains } from './resolve-import.ts';
import { sha256 } from './build-inputs.ts';

export interface BuildContextInput {
  mode: string;
  base: string;
  configFile?: string | false;
  configFileDependencies: readonly string[];
  root: string;
  outDir: string;
  envDir: string | false;
  env: Readonly<Record<string, unknown>>;
}
export interface BuildContextSnapshot {
  context: {
    mode: string;
    base: string;
    configFile: string | false;
    configFileDependencies: string[];
    root: string;
    outDir: string;
    envDir: string | false;
    environment: Record<string, string>;
  };
  inputs: { file: string; sha256: string | null }[];
  contextHash: string;
}
const normalize = (file: string) => file.replaceAll('\\', '/');
export function sealBuildContext(inputHash: string, snapshot: Omit<BuildContextSnapshot, 'contextHash'>): string {
  return sha256(JSON.stringify({ inputHash, context: snapshot.context, inputs: snapshot.inputs }));
}
/** Actual resolved configuration and its extra sources, separate from the public source-only hash. */
export function readBuildContext(
  workspaceRoot: string,
  inputHash: string,
  value: BuildContextInput,
): BuildContextSnapshot {
  workspaceRoot = realpathSync(workspaceRoot);
  const path = (file: string) => {
    const actual = existsSync(file) ? realpathSync(file) : resolve(file);
    return normalize(contains(workspaceRoot, actual) ? relative(workspaceRoot, actual) || '.' : actual);
  };
  const context = {
    mode: value.mode,
    base: value.base,
    configFile: value.configFile ? path(value.configFile) : (false as const),
    configFileDependencies: [...new Set(value.configFileDependencies.map(path))].sort(),
    root: path(value.root),
    outDir: normalize(relative(value.root, resolve(value.root, value.outDir))) || '.',
    envDir: value.envDir === false ? (false as const) : path(value.envDir),
    environment: Object.fromEntries(
      Object.entries(value.env)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, sha256(JSON.stringify(val) ?? 'undefined')]),
    ),
  };
  const extra = new Set<string>();
  for (const file of [...value.configFileDependencies, ...(value.configFile ? [value.configFile] : [])]) {
    if (!existsSync(file) || !statSync(file).isFile()) throw Error(`Build context config source is missing: ${file}`);
    extra.add(path(file));
  }
  const outputPath = resolve(realpathSync(value.root), value.outDir);
  const outputRoot = existsSync(outputPath) ? realpathSync(outputPath) : outputPath;
  // The actual root can use arbitrary entry/source/static layouts. Capture all
  // regular inputs there, excluding the resolved output and tool-owned paths.
  // Directory names and resource extensions do not establish output ownership.
  for (const file of globSync('**/*', {
    cwd: value.root,
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/.vite/**',
      '**/.vite-temp/**',
      '**/.pnpm-store/**',
      '**/.superpowers/**',
      '**/.verification-private/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  })) {
    const absolute = resolve(value.root, file);
    if (!contains(outputRoot, realpathSync(absolute)) && statSync(absolute).isFile()) extra.add(path(absolute));
  }
  if (value.envDir !== false)
    for (const name of ['.env', '.env.local', `.env.${value.mode}`, `.env.${value.mode}.local`])
      extra.add(path(resolve(value.envDir, name)));
  const inputs = [...extra].sort().map(file => {
    const absolute = isAbsolute(file) ? file : resolve(workspaceRoot, file);
    return { file, sha256: existsSync(absolute) ? sha256(readFileSync(absolute)) : null };
  });
  return { context, inputs, contextHash: sealBuildContext(inputHash, { context, inputs }) };
}
export function verifyBuildContext(
  workspaceRoot: string,
  inputHash: string,
  actual: BuildContextSnapshot,
  expected: BuildContextSnapshot,
): void {
  if (
    !actual ||
    !actual.context ||
    !Array.isArray(actual.inputs) ||
    actual.contextHash !== sealBuildContext(inputHash, actual)
  )
    throw Error('Missing or invalid build context provenance');
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw Error('Build context differs from expected resolved configuration');
  for (const input of actual.inputs) {
    const file = isAbsolute(input.file) ? input.file : resolve(workspaceRoot, input.file);
    const current = existsSync(file) && statSync(file).isFile() ? sha256(readFileSync(file)) : null;
    if (current !== input.sha256) throw Error(`Current build context input hash differs: ${input.file}`);
  }
}
