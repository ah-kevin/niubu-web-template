import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hookCommands = {
  'pre-commit': 'node scripts/git-hooks/pre-commit.ts',
  'commit-msg': 'node scripts/git-hooks/commit-msg.ts "$1"',
} as const;

export function gitEnvironment() {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1' };
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_PREFIX',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ])
    delete env[key];
  return env;
}

export function git(root: string, args: string[]) {
  const env = gitEnvironment();
  const result = spawnSync('git', args, { cwd: root, env, shell: false, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Git ${args[0]} failed (exit ${result.status ?? 'signal'}).`);
  return result.stdout;
}

export async function repository(root: string, gitDir?: string) {
  const base = await realpath(root);
  const top = await realpath(git(base, ['rev-parse', '--show-toplevel']).toString().trim());
  if (base !== top) throw new Error('Hook root must be the repository root.');
  const actualGitDir = await realpath(git(base, ['rev-parse', '--absolute-git-dir']).toString().trim());
  if (gitDir && (await realpath(gitDir)) !== actualGitDir) throw new Error('gitDir does not match this repository.');
  return { root: base, gitDir: actualGitDir };
}

export function sensitivePath(path: string) {
  return path
    .split(/[\\/]/)
    .some(
      part =>
        /^\.env(?:\.|$)/i.test(part) ||
        /^(?:\.git|\.ssh|\.aws|\.gnupg|\.npmrc|\.netrc|credentials(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?)$/i.test(
          part,
        ) ||
        /\.(?:pem|key|p12|pfx|keystore)$/i.test(part),
    );
}

export async function safePath(root: string, path: string, allowMissing = false) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error('Path is outside the repository.');
  let current = root;
  const parts = rel.split(sep);
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index]);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Refusing a symlink path.');
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error('Parent path is not a directory.');
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return absolute;
      throw error;
    }
  }
  return absolute;
}

export async function rewriteMatching(root: string, path: string, staged: Buffer, formatted: string) {
  const absolute = await safePath(root, path, true);
  let handle;
  try {
    handle = await open(absolute, constants.O_RDWR | constants.O_NOFOLLOW);
    if (!(await handle.stat()).isFile() || (await handle.stat()).nlink !== 1) return false;
    if (!(await handle.readFile()).equals(staged)) return false;
    await safePath(root, path);
    const bytes = Buffer.from(formatted);
    await handle.write(bytes, 0, bytes.length, 0);
    await handle.truncate(bytes.length);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  } finally {
    await handle?.close();
  }
}

export function localPackage(root: string, name: string) {
  return createRequire(join(root, 'package.json')).resolve(`${name}/package.json`);
}

export function packageBin(root: string, name: string, bin: string) {
  const require = createRequire(join(root, 'package.json'));
  const manifestPath = localPackage(root, name);
  const manifest = require(manifestPath) as { bin: string | Record<string, string> };
  const path = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[bin];
  if (!path) throw new Error(`Local ${name} CLI is unavailable.`);
  return resolve(dirname(manifestPath), path);
}

export function cli(meta: string, action: () => Promise<number>) {
  if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(meta)) {
    void action()
      .then(code => {
        process.exitCode = code;
      })
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : 'Hook failed.');
        process.exitCode = 1;
      });
  }
}
