import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPreCommit } from '../../../scripts/git-hooks/pre-commit.ts';
import { installHooks } from '../../../scripts/git-hooks/install.ts';
import { runCommitMessage } from '../../../scripts/git-hooks/commit-msg.ts';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const roots: string[] = [];
const fixtureEnv: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(fixtureEnv)) if (key.startsWith('GIT_')) delete fixtureEnv[key];
for (const key of ['SKIP_SIMPLE_GIT_HOOKS', 'SIMPLE_GIT_HOOKS_RC', 'INIT_CWD']) delete fixtureEnv[key];
Object.assign(fixtureEnv, {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
});
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function put(root: string, path: string, content: string | Buffer) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function git(root: string, args: string[], allowFailure = false) {
  const result = spawnSync('git', args, { cwd: root, env: fixtureEnv, shell: false, encoding: 'utf8' });
  if (!allowFailure && result.status !== 0)
    throw new Error(`fixture git ${args[0]}: ${result.error?.message ?? result.stderr}`);
  return result;
}
function fixture() {
  const root = realpathSync(mkdtempSync('/private/tmp/niubu-stage7-hooks-'));
  roots.push(root);
  git(root, ['init', '--quiet', '--template=']);
  git(root, ['config', '--local', 'user.name', 'Stage7 Fixture']);
  git(root, ['config', '--local', 'user.email', 'stage7@example.invalid']);
  git(root, ['config', '--local', 'commit.gpgSign', 'false']);
  git(root, ['config', '--local', 'core.autocrlf', 'false']);
  put(
    root,
    'package.json',
    JSON.stringify({
      type: 'module',
      'simple-git-hooks': {
        preserveUnused: true,
        'pre-commit': 'node scripts/git-hooks/pre-commit.ts',
        'commit-msg': 'node scripts/git-hooks/commit-msg.ts "$1"',
      },
    }),
  );
  put(root, '.prettierrc.json', JSON.stringify({ singleQuote: true, semi: true }));
  put(root, '.prettierignore', 'ignored/**\n');
  put(
    root,
    'eslint.config.mjs',
    "export default [{ ignores: ['ignored/**'] }, { files: ['**/*.{js,mjs}'], rules: { 'no-debugger': 'error' } }];\n",
  );
  symlinkSync(join(workspace, 'node_modules'), join(root, 'node_modules'), 'dir');
  cpSync(join(workspace, 'scripts/git-hooks'), join(root, 'scripts/git-hooks'), { recursive: true });
  if (existsSync(join(workspace, 'commitlint.config.cjs')))
    cpSync(join(workspace, 'commitlint.config.cjs'), join(root, 'commitlint.config.cjs'));
  return root;
}
function tree(root: string) {
  return git(root, ['write-tree']).stdout;
}

describe('staged checks', () => {
  it('reports a usable staged formatting diff for partial staging without applying it', async () => {
    const root = fixture();
    put(root, 'partial diff\n.js', 'export const staged={value:1}\n');
    git(root, ['add', '--', 'partial diff\n.js']);
    put(root, 'partial diff\n.js', 'export const worktree = 2;\n');
    const before = tree(root);
    const output: string[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(value => {
      output.push(String(value));
    });
    try {
      expect(await runPreCommit({ root })).not.toBe(0);
    } finally {
      error.mockRestore();
    }
    const report = output.find(value => value.includes('formatting diff:\n')) ?? '';
    const patch = report.slice(report.indexOf('formatting diff:\n') + 'formatting diff:\n'.length);
    put(root, 'staged-format.patch', patch);
    const applicable = git(root, ['apply', '--cached', '--check', '--', 'staged-format.patch'], true);
    expect(applicable.status, applicable.stderr).toBe(0);
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, 'partial diff\n.js'), 'utf8')).toBe('export const worktree = 2;\n');
  });

  it('rejects a rename from a sensitive source before reading its renamed blob', async () => {
    const root = fixture();
    put(root, '.env.synthetic', "export const credential = 'SYNTHETIC_ONLY';\n");
    git(root, ['add', '--', '.env.synthetic']);
    git(root, ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture base']);
    git(root, ['mv', '--', '.env.synthetic', 'renamed.js']);
    const before = tree(root);
    expect(await runPreCommit({ root })).not.toBe(0);
    expect(tree(root)).toBe(before);
  });

  it('rejects staged formatting changes while preserving partially staged bytes and index', async () => {
    const root = fixture();
    put(root, 'partial.js', 'export const staged={value:1}\n');
    git(root, ['add', '--', 'partial.js']);
    const unstaged = Buffer.from('export const staged = { value: 2 };\n// unstaged only\n');
    put(root, 'partial.js', unstaged);
    const before = tree(root);
    expect(await runPreCommit({ root })).not.toBe(0);
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, 'partial.js'))).toEqual(unstaged);
  });

  it('writes formatting only to matching worktree bytes and still rejects until manual staging', async () => {
    const root = fixture();
    put(root, 'same.js', 'export const value={x:1}\n');
    git(root, ['add', '--', 'same.js']);
    const before = tree(root);
    expect(await runPreCommit({ root })).not.toBe(0);
    expect(readFileSync(join(root, 'same.js'), 'utf8')).toBe('export const value = { x: 1 };\n');
    expect(tree(root)).toBe(before);
    git(root, ['add', '--', 'same.js']);
    expect(await runPreCommit({ root })).toBe(0);
  });

  it('lints the staged blob even if the worktree is clean', async () => {
    const root = fixture();
    put(root, 'lint.js', 'debugger;\n');
    git(root, ['add', '--', 'lint.js']);
    put(root, 'lint.js', 'export const clean = true;\n');
    const before = tree(root);
    expect(await runPreCommit({ root })).not.toBe(0);
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, 'lint.js'), 'utf8')).toBe('export const clean = true;\n');
  });

  it('rejects sensitive paths and staged symlinks without following their target', async () => {
    const root = fixture();
    put(root, 'synthetic-target', 'synthetic only\n');
    symlinkSync(join(root, 'synthetic-target'), join(root, 'link.js'));
    git(root, ['add', '--', 'link.js']);
    expect(await runPreCommit({ root })).not.toBe(0);
    git(root, ['reset', '--', 'link.js']);
    put(root, '.env.local', 'SYNTHETIC_ONLY=placeholder\n');
    git(root, ['add', '--', '.env.local']);
    expect(await runPreCommit({ root })).not.toBe(0);
  });

  it('handles NUL-safe rename targets, deletion, binary, invalid UTF8, ignored paths and special names', async () => {
    const root = fixture();
    put(root, 'old.js', 'export const old = true;\n');
    put(root, 'deleted.js', 'debugger;\n');
    git(root, ['add', '--', 'old.js', 'deleted.js']);
    git(root, ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture base']);
    git(root, ['mv', '--', 'old.js', 'new name\n目标.js']);
    git(root, ['rm', '--', 'deleted.js']);
    for (const name of ['-leading.js', 'space name.js', 'line\nbreak.js']) put(root, name, 'export const ok = true;\n');
    put(root, 'image.bin', Buffer.from([0, 255, 128, 1]));
    put(root, 'bad-utf8.js', Buffer.from([255, 254, 128]));
    put(root, 'ignored/skip.js', 'debugger;\n');
    git(root, [
      'add',
      '--',
      '-leading.js',
      'space name.js',
      'line\nbreak.js',
      'image.bin',
      'bad-utf8.js',
      'ignored/skip.js',
    ]);
    const before = tree(root);
    expect(await runPreCommit({ root })).toBe(0);
    expect(tree(root)).toBe(before);
    expect(await runPreCommit({ root, gitDir: join(root, '.git') })).toBe(0);
  });

  it('rejects mismatched gitDir and parent symlinks without writing outside the root', async () => {
    const root = fixture();
    put(root, 'dir/file.js', 'export const value={x:1}\n');
    git(root, ['add', '--', 'dir/file.js']);
    const outside = realpathSync(mkdtempSync('/private/tmp/niubu-stage7-hooks-outside-'));
    roots.push(outside);
    put(outside, 'file.js', 'synthetic outside\n');
    rmSync(join(root, 'dir'), { recursive: true });
    symlinkSync(outside, join(root, 'dir'), 'dir');
    expect(await runPreCommit({ root })).not.toBe(0);
    expect(readFileSync(join(outside, 'file.js'), 'utf8')).toBe('synthetic outside\n');
    expect(await runPreCommit({ root, gitDir: join(outside, '.git') })).not.toBe(0);
  });

  it('accepts an empty staged set', async () => {
    expect(await runPreCommit({ root: fixture() })).toBe(0);
  });

  it('checks the effective index supplied by Git without changing either index', async () => {
    const root = fixture();
    put(root, 'effective.js', 'export const clean = true;\n');
    git(root, ['add', '--', 'effective.js']);
    const normalIndex = readFileSync(join(root, '.git/index'));
    const alternate = join(root, '.git/fixture-index');
    cpSync(join(root, '.git/index'), alternate);
    put(root, 'effective.js', 'debugger;\n');
    const staged = spawnSync('git', ['add', '--', 'effective.js'], {
      cwd: root,
      shell: false,
      env: { ...fixtureEnv, GIT_INDEX_FILE: alternate },
      encoding: 'utf8',
    });
    expect(staged.status).toBe(0);
    const effectiveIndex = readFileSync(alternate);
    const previous = process.env.GIT_INDEX_FILE;
    try {
      process.env.GIT_INDEX_FILE = alternate;
      expect(await runPreCommit({ root })).not.toBe(0);
    } finally {
      if (previous === undefined) delete process.env.GIT_INDEX_FILE;
      else process.env.GIT_INDEX_FILE = previous;
    }
    expect(readFileSync(alternate)).toEqual(effectiveIndex);
    expect(readFileSync(join(root, '.git/index'))).toEqual(normalIndex);
    expect(readFileSync(join(root, 'effective.js'), 'utf8')).toBe('debugger;\n');
  });

  it('checks dirty rename targets and treats pathspec characters literally', async () => {
    const root = fixture();
    put(root, 'source.js', 'export const source = true;\n');
    git(root, ['add', '--', 'source.js']);
    git(root, ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture base']);
    git(root, ['mv', '--', 'source.js', 'rename target\n.js']);
    put(root, 'rename target\n.js', 'export const source = true;\nexport const added={x:1}\n');
    put(root, ':literal.js', 'debugger;\n');
    git(root, ['--literal-pathspecs', 'add', '--', 'rename target\n.js', ':literal.js']);
    const before = tree(root);
    expect(await runPreCommit({ root })).not.toBe(0);
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, 'rename target\n.js'), 'utf8')).toBe(
      'export const source = true;\nexport const added = { x: 1 };\n',
    );
  });
});

describe('hook installation conflicts', () => {
  it('honors a synthetic global hooksPath without changing global or local configuration', () => {
    const root = fixture();
    const globalFile = join(root, 'fixture-global.gitconfig');
    put(root, 'fixture-global.gitconfig', '[core]\n\thooksPath = protected-global-hooks\n');
    const result = spawnSync(process.execPath, [join(root, 'scripts/git-hooks/install.ts')], {
      cwd: root,
      shell: false,
      env: { ...fixtureEnv, GIT_CONFIG_GLOBAL: globalFile },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(readFileSync(globalFile, 'utf8')).toBe('[core]\n\thooksPath = protected-global-hooks\n');
    expect(git(root, ['config', '--local', '--get', 'core.hooksPath'], true).status).toBe(1);
    expect(existsSync(join(root, 'protected-global-hooks'))).toBe(false);
    expect(existsSync(join(root, '.git/hooks/pre-commit'))).toBe(false);
  });

  it('refuses competing tool configuration without executing or replacing it', () => {
    const root = fixture();
    const content = "throw new Error('this user config must not execute');\n";
    put(root, '.simple-git-hooks.cjs', content);
    const result = nodeCLI(root, 'install.ts');
    expect(result.status).not.toBe(0);
    expect(readFileSync(join(root, '.simple-git-hooks.cjs'), 'utf8')).toBe(content);
    expect(existsSync(join(root, '.git/hooks/pre-commit'))).toBe(false);
  });

  it('refuses symlinked Git directories without writing through them', () => {
    const root = fixture();
    const outside = realpathSync(mkdtempSync('/private/tmp/niubu-stage7-hooks-outside-'));
    roots.push(outside);
    cpSync(join(root, '.git'), join(outside, 'fixture-git'), { recursive: true });
    rmSync(join(root, '.git'), { recursive: true });
    symlinkSync(join(outside, 'fixture-git'), join(root, '.git'), 'dir');
    const result = nodeCLI(root, 'install.ts');
    expect(result.status).not.toBe(0);
    expect(existsSync(join(outside, 'fixture-git/hooks/pre-commit'))).toBe(false);
  });

  it('refuses existing user hooks without overwriting', async () => {
    const root = fixture();
    put(root, '.git/hooks/pre-commit', '#!/bin/sh\n# user owned\n');
    expect(await installHooks({ root })).not.toBe(0);
    expect(readFileSync(join(root, '.git/hooks/pre-commit'), 'utf8')).toBe('#!/bin/sh\n# user owned\n');
    expect(existsSync(join(root, '.git/hooks/commit-msg'))).toBe(false);
  });

  it('preserves a user hooksPath and refuses symlinked hook directories', async () => {
    const root = fixture();
    git(root, ['config', '--local', 'core.hooksPath', 'user-hooks']);
    expect(await installHooks({ root })).not.toBe(0);
    expect(git(root, ['config', '--get', 'core.hooksPath']).stdout.trim()).toBe('user-hooks');
    git(root, ['config', '--local', '--unset', 'core.hooksPath']);
    rmSync(join(root, '.git/hooks'), { recursive: true, force: true });
    const outside = realpathSync(mkdtempSync('/private/tmp/niubu-stage7-hooks-outside-'));
    roots.push(outside);
    symlinkSync(outside, join(root, '.git/hooks'), 'dir');
    expect(await installHooks({ root })).not.toBe(0);
    expect(existsSync(join(outside, 'pre-commit'))).toBe(false);
  });
});

describe('commit message path protection', () => {
  it('rejects missing messages and symlinked message paths', async () => {
    const root = fixture();
    expect(await runCommitMessage({ root, messageFile: join(root, 'missing') })).not.toBe(0);
    put(root, 'synthetic-message', 'feat: synthetic\n');
    symlinkSync(join(root, 'synthetic-message'), join(root, 'message-link'));
    expect(await runCommitMessage({ root, messageFile: join(root, 'message-link') })).not.toBe(0);
    expect(readFileSync(join(root, 'synthetic-message'), 'utf8')).toBe('feat: synthetic\n');
  });
});

function nodeCLI(root: string, script: string, args: string[] = []) {
  return spawnSync(process.execPath, [join(root, 'scripts/git-hooks', script), ...args], {
    cwd: root,
    env: fixtureEnv,
    shell: false,
    encoding: 'utf8',
  });
}
function installedFixture() {
  const root = fixture();
  put(root, '.git/hooks/pre-push', '#!/bin/sh\n# unrelated user hook\n');
  const installed = nodeCLI(root, 'install.ts');
  expect(installed.status, installed.stderr + installed.stdout).toBe(0);
  expect(existsSync(join(root, '.git/hooks/pre-push'))).toBe(true);
  expect(readFileSync(join(root, '.git/hooks/pre-push'), 'utf8')).toBe('#!/bin/sh\n# unrelated user hook\n');
  for (const name of ['pre-commit', 'commit-msg']) expect(existsSync(join(root, '.git/hooks', name))).toBe(true);
  return root;
}

function trackedTypeFixture(symlink: boolean) {
  const root = fixture();
  put(root, 'synthetic-target', 'synthetic target only\n');
  if (symlink) symlinkSync('synthetic-target', join(root, 'typed.js'));
  else put(root, 'typed.js', 'export const original = true;\n');
  git(root, ['add', '--', 'typed.js']);
  git(root, ['commit', '--quiet', '-m', 'test(hooks): seed tracked type']);
  const installed = nodeCLI(root, 'install.ts');
  expect(installed.status, installed.stderr + installed.stdout).toBe(0);
  return root;
}

function expectApplicablePartialDiff(path: string, staged: Buffer, worktree: Buffer) {
  const root = fixture();
  put(root, path, staged);
  git(root, ['--literal-pathspecs', 'add', '--', path]);
  put(root, path, worktree);
  const before = tree(root);
  const indexBytes = readFileSync(join(root, '.git/index'));
  const rejected = nodeCLI(root, 'pre-commit.ts');
  expect(rejected.status, rejected.stderr + rejected.stdout).toBe(1);
  const marker = 'formatting diff:\n';
  expect(rejected.stderr).toContain(marker);
  const patch = rejected.stderr.slice(rejected.stderr.indexOf(marker) + marker.length);
  put(root, 'review-format.patch', patch);
  const applicable = git(root, ['apply', '--cached', '--check', '--', 'review-format.patch'], true);
  expect(readFileSync(join(root, '.git/index'))).toEqual(indexBytes);
  expect(tree(root)).toBe(before);
  expect(readFileSync(join(root, path))).toEqual(worktree);
  expect(applicable.status, applicable.stderr).toBe(0);
  return patch;
}

describe('F3 UTF-8 BOM preservation', () => {
  it.each(['export const staged={value:1}\n', 'export const staged={value:1}'])(
    'reports an applicable partial-staged BOM diff for %j without changing index or worktree',
    source => {
      const staged = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source)]);
      const worktree = Buffer.from('\uFEFFexport const worktree = 2;\n// keep unstaged\n');
      const patch = expectApplicablePartialDiff('bom.js', staged, worktree);
      expect(patch).toContain('-\uFEFFexport const staged={value:1}');
      expect(patch).toContain('+\uFEFFexport const staged = { value: 1 };');
    },
  );

  it('retains the original BOM when formatting a matching worktree', async () => {
    const root = fixture();
    const staged = Buffer.from('\uFEFFexport const value={x:1}\n');
    put(root, 'bom.js', staged);
    git(root, ['add', '--', 'bom.js']);
    const before = tree(root);
    const indexBytes = readFileSync(join(root, '.git/index'));
    expect(await runPreCommit({ root })).toBe(1);
    expect(readFileSync(join(root, 'bom.js'))).toEqual(Buffer.from('\uFEFFexport const value = { x: 1 };\n'));
    expect(readFileSync(join(root, '.git/index'))).toEqual(indexBytes);
    expect(tree(root)).toBe(before);
  });
});

describe('F4 Git patch path quoting', () => {
  it.each([
    'control\u0001.js',
    'escape\u001b.js',
    'unit\u001f.js',
    'delete\u007f.js',
    'tab\tback\b.js',
    'line\nreturn\r.js',
    'quote"back\\slash.js',
    '目标😀.js',
    '-space name.js',
  ])('reports an applicable partial-staged diff for %j without changing index or worktree', path => {
    expectApplicablePartialDiff(
      path,
      Buffer.from('export const staged={value:1}\n'),
      Buffer.from('export const worktree = 2;\n// keep unstaged\n'),
    );
  });
});

describe('F2 tracked type changes through Git', () => {
  it.each([
    {
      name: 'lint',
      staged: 'debugger;\n',
      worktree: 'export const unstaged = true;\n',
      diagnostic: 'no-debugger',
      after: 'export const unstaged = true;\n',
    },
    {
      name: 'format',
      staged: 'export const value={x:1}\n',
      worktree: 'export const value={x:1}\n',
      diagnostic: 'Formatted',
      after: 'export const value = { x: 1 };\n',
    },
  ])('rejects a tracked symlink replaced by an ordinary JS file with $name errors', entry => {
    const root = trackedTypeFixture(true);
    rmSync(join(root, 'typed.js'));
    put(root, 'typed.js', entry.staged);
    git(root, ['add', '--', 'typed.js']);
    put(root, 'typed.js', entry.worktree);
    expect(git(root, ['diff', '--cached', '--name-status']).stdout).toBe('T\ttyped.js\n');
    const before = tree(root);
    const head = git(root, ['rev-parse', 'HEAD']).stdout;
    const rejected = git(root, ['commit', '--quiet', '-m', 'fix(hooks): replace synthetic symlink'], true);
    expect(rejected.status, rejected.stderr + rejected.stdout).toBe(1);
    expect(rejected.stderr + rejected.stdout).toContain(entry.diagnostic);
    expect(tree(root)).toBe(before);
    expect(git(root, ['rev-parse', 'HEAD']).stdout).toBe(head);
    expect(readFileSync(join(root, 'typed.js'), 'utf8')).toBe(entry.after);
  });

  it('accepts a clean ordinary JS replacement for a tracked symlink', () => {
    const root = trackedTypeFixture(true);
    rmSync(join(root, 'typed.js'));
    put(root, 'typed.js', 'export const replacement = true;\n');
    git(root, ['add', '--', 'typed.js']);
    expect(git(root, ['diff', '--cached', '--name-status']).stdout).toBe('T\ttyped.js\n');
    const committed = git(root, ['commit', '--quiet', '-m', 'fix(hooks): accept ordinary replacement'], true);
    expect(committed.status, committed.stderr + committed.stdout).toBe(0);
    expect(git(root, ['show', 'HEAD:typed.js']).stdout).toBe('export const replacement = true;\n');
  });

  it('rejects a tracked ordinary file replaced by a symlink without following it', () => {
    const root = trackedTypeFixture(false);
    rmSync(join(root, 'typed.js'));
    symlinkSync('synthetic-target', join(root, 'typed.js'));
    git(root, ['add', '--', 'typed.js']);
    expect(git(root, ['diff', '--cached', '--name-status']).stdout).toBe('T\ttyped.js\n');
    const before = tree(root);
    const head = git(root, ['rev-parse', 'HEAD']).stdout;
    const rejected = git(root, ['commit', '--quiet', '-m', 'fix(hooks): reject symlink replacement'], true);
    expect(rejected.status, rejected.stderr + rejected.stdout).toBe(1);
    expect(rejected.stderr + rejected.stdout).toMatch(/symlink|non-regular/);
    expect(tree(root)).toBe(before);
    expect(git(root, ['rev-parse', 'HEAD']).stdout).toBe(head);
    expect(lstatSync(join(root, 'typed.js')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(root, 'typed.js'))).toBe('synthetic-target');
    expect(readFileSync(join(root, 'synthetic-target'), 'utf8')).toBe('synthetic target only\n');
  });
});

describe('real selected tools and Git-invoked hooks', () => {
  it.each([
    'feat(hooks): support staged checks',
    'feat!: change hook contract\n\nBREAKING CHANGE: synthetic contract changed',
    'fix(hooks): support footer\n\nRefs: #7',
  ])('accepts a conventional message through Git: %s', message => {
    const root = installedFixture();
    const committed = git(root, ['commit', '--allow-empty', '--quiet', '-m', message], true);
    expect(committed.status, committed.stderr + committed.stdout).toBe(0);
    expect(git(root, ['log', '-1', '--format=%B']).stdout.trim()).toBe(message);
  });

  it('rejects a bad message through the real commit-msg hook', () => {
    const root = installedFixture();
    const committed = git(root, ['commit', '--allow-empty', '--quiet', '-m', 'ordinary invalid message'], true);
    expect(committed.status).not.toBe(0);
    expect(committed.stderr + committed.stdout).toMatch(/subject-empty|type-empty/);
    expect(git(root, ['rev-parse', '--verify', 'HEAD'], true).status).not.toBe(0);
  });

  it('rejects staged formatting through Git, preserves the index, then accepts manual restaging', () => {
    const root = installedFixture();
    put(root, '-format name\n.js', 'export const value={x:1}\n');
    git(root, ['add', '--', '-format name\n.js']);
    const before = tree(root);
    const rejected = git(root, ['commit', '--quiet', '-m', 'fix(hooks): format synthetic file'], true);
    expect(rejected.status).not.toBe(0);
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, '-format name\n.js'), 'utf8')).toBe('export const value = { x: 1 };\n');
    git(root, ['add', '--', '-format name\n.js']);
    const committed = git(root, ['commit', '--quiet', '-m', 'fix(hooks): format synthetic file'], true);
    expect(committed.status, committed.stderr + committed.stdout).toBe(0);
  });

  it('rejects staged lint errors through Git without changing index or unstaged bytes', () => {
    const root = installedFixture();
    put(root, 'lint.js', 'debugger;\n');
    git(root, ['add', '--', 'lint.js']);
    put(root, 'lint.js', 'export const unstaged = true;\n');
    const before = tree(root);
    const rejected = git(root, ['commit', '--quiet', '-m', 'fix(hooks): reject synthetic lint'], true);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr + rejected.stdout).toContain('no-debugger');
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, 'lint.js'), 'utf8')).toBe('export const unstaged = true;\n');
  });

  it('preserves partial staging through the Git-invoked hook', () => {
    const root = installedFixture();
    put(root, 'partial.js', 'export const staged={x:1}\n');
    git(root, ['add', '--', 'partial.js']);
    const worktree = 'export const staged = { x: 2 };\n// keep unstaged\n';
    put(root, 'partial.js', worktree);
    const before = tree(root);
    const rejected = git(root, ['commit', '--quiet', '-m', 'fix(hooks): preserve partial staging'], true);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr + rejected.stdout).toContain('Partial staging');
    expect(tree(root)).toBe(before);
    expect(readFileSync(join(root, 'partial.js'), 'utf8')).toBe(worktree);
  });

  it('passes message paths containing spaces and newlines as one argv argument', async () => {
    const root = installedFixture();
    const messageFile = join(root, '-message file\n.txt');
    put(root, '-message file\n.txt', 'feat(hooks): preserve argv\n');
    expect(await runCommitMessage({ root, messageFile })).toBe(0);
    expect(readFileSync(messageFile, 'utf8')).toBe('feat(hooks): preserve argv\n');
    put(root, '-message file\n.txt', 'invalid synthetic message\n');
    expect(await runCommitMessage({ root, messageFile })).not.toBe(0);
    expect(readFileSync(messageFile, 'utf8')).toBe('invalid synthetic message\n');
  });
});
