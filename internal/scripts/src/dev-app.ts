import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectFrontendApp } from './frontend-apps.ts';

export type AppSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; stdio: 'inherit'; shell: false },
) => { status: number | null; error?: Error };

/** Engineering-only dispatcher. The selected app remains responsible for its Vite command. */
export function runDevApp({
  root,
  args,
  spawn = spawnSync,
}: {
  root: string;
  args: readonly string[];
  spawn?: AppSpawn;
}): number {
  const input = [...args];
  const command = input.shift();
  if (command !== 'dev' && command !== 'preview') throw Error('Expected dev or preview command');
  if (input[0] === '--') input.shift();
  let appName: string | undefined;
  const forwarded: string[] = [];
  for (let index = 0; index < input.length; index++) {
    const argument = input[index];
    if (argument === '--app' || argument.startsWith('--app=')) {
      if (appName !== undefined) throw Error('Pass --app only once');
      appName = argument === '--app' ? input[++index] : argument.slice('--app='.length);
      if (!appName || appName.startsWith('-')) throw Error('--app requires a workspace name');
    } else forwarded.push(argument);
  }
  const app = selectFrontendApp(root, appName);
  const result = spawn('pnpm', ['--filter', app.name, command, ...forwarded], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runDevApp({ root: process.cwd(), args: process.argv.slice(2) });
}
