import { spawnSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cli, git, gitEnvironment, hookCommands, packageBin, repository, safePath } from './shared.ts';

export async function installHooks(options: { root: string }): Promise<number> {
  try {
    const { root } = await repository(options.root);
    await safePath(root, '.git');
    const gitDir = await realpath(resolve(root, git(root, ['rev-parse', '--git-common-dir']).toString().trim()));
    const hooksPath = spawnSync('git', ['config', '--get-all', 'core.hooksPath'], {
      cwd: root,
      env: gitEnvironment(),
      shell: false,
      encoding: 'utf8',
    });
    if (hooksPath.error || (hooksPath.status !== 0 && hooksPath.status !== 1))
      throw new Error('Cannot inspect core.hooksPath.');
    if (hooksPath.status === 0) throw new Error('Existing core.hooksPath is protected; hooks were not installed.');
    await safePath(gitDir, 'hooks', true);
    for (const name of Object.keys(hookCommands)) {
      const path = join(gitDir, 'hooks', name);
      try {
        await lstat(path);
        throw new Error(`Existing ${name} hook is protected; hooks were not installed.`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    for (const name of [
      '.simple-git-hooks.cjs',
      '.simple-git-hooks.js',
      '.simple-git-hooks.mjs',
      'simple-git-hooks.cjs',
      'simple-git-hooks.js',
      'simple-git-hooks.mjs',
      '.simple-git-hooks.json',
      'simple-git-hooks.json',
    ]) {
      try {
        await lstat(join(root, name));
        throw new Error('An existing simple-git-hooks config is protected; hooks were not installed.');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    await safePath(root, 'package.json');
    const config = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
    const hooks = config['simple-git-hooks'] as Record<string, unknown> | undefined;
    if (
      !hooks ||
      Object.keys(hooks).length !== 3 ||
      hooks.preserveUnused !== true ||
      Object.entries(hookCommands).some(([key, value]) => hooks[key] !== value)
    ) {
      throw new Error('Expected the two reviewed simple-git-hooks commands and preserveUnused: true in package.json.');
    }
    const result = spawnSync(process.execPath, [packageBin(root, 'simple-git-hooks', 'simple-git-hooks')], {
      cwd: root,
      shell: false,
      stdio: 'inherit',
      env: { ...gitEnvironment(), SKIP_INSTALL_SIMPLE_GIT_HOOKS: '0' },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    // The selected upstream CLI logs errors without setting a failing exit code.
    for (const [name, command] of Object.entries(hookCommands)) {
      const path = await safePath(gitDir, `hooks/${name}`);
      const stat = await lstat(path);
      if (!stat.isFile() || !(stat.mode & 0o111) || !(await readFile(path, 'utf8')).endsWith(command)) {
        throw new Error(`The selected hook tool did not activate ${name}.`);
      }
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Hook installation failed.');
    return 1;
  }
}

cli(import.meta.url, () => installHooks({ root: process.cwd() }));
