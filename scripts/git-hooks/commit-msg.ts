import { spawnSync } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { cli, packageBin, repository, safePath, sensitivePath } from './shared.ts';

export async function runCommitMessage(options: { root: string; messageFile: string }): Promise<number> {
  try {
    const { root, gitDir } = await repository(options.root);
    if (!options.messageFile) throw new Error('A commit message file is required.');
    const messageFile = resolve(root, options.messageFile);
    const gitRelative = relative(gitDir, messageFile);
    const inGitDir =
      gitRelative && gitRelative !== '..' && !gitRelative.startsWith(`..${sep}`) && !isAbsolute(gitRelative);
    const base = inGitDir ? gitDir : root;
    const path = relative(base, messageFile);
    if (sensitivePath(path)) throw new Error('Refusing a sensitive message path.');
    await safePath(base, path);
    if (!(await lstat(messageFile)).isFile()) throw new Error('The commit message must be a regular file.');
    await safePath(root, 'commitlint.config.cjs');
    const result = spawnSync(
      process.execPath,
      [
        packageBin(root, '@commitlint/cli', 'commitlint'),
        '--cwd',
        root,
        '--config',
        join(root, 'commitlint.config.cjs'),
        '--edit',
        messageFile,
      ],
      {
        cwd: root,
        shell: false,
        stdio: 'inherit',
      },
    );
    if (result.error) throw result.error;
    return result.status ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Commit message check failed.');
    return 1;
  }
}

cli(import.meta.url, () => runCommitMessage({ root: process.cwd(), messageFile: process.argv[2] ?? '' }));
