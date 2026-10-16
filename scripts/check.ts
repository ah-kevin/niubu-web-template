import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkWorkspace } from '@niubu-internal/scripts/workspace-check';
import { checkBoundary, readBoundaryConfig } from '@niubu-internal/scripts/boundary-check';

type CheckSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; stdio: 'inherit'; shell: false },
) => { status: number | null; error?: Error };

export function runChecks({
  root,
  workspaceOnly = false,
  spawn = spawnSync,
  report = console.log,
}: {
  root: string;
  workspaceOnly?: boolean;
  spawn?: CheckSpawn;
  report?: (message: string) => void;
}): number {
  const workspace = checkWorkspace(root);
  if (workspace.errors.length) {
    workspace.errors.forEach(error => report(error));
    return 1;
  }
  const boundary = checkBoundary(root, readBoundaryConfig(root));
  if (boundary.errors.length) {
    boundary.errors.forEach(error => report(error));
    return 1;
  }
  report('Workspace graph, source exports, test ownership and boundary passed.');
  if (workspaceOnly) return 0;
  // pnpm appends this argument to the existing script tail (Turbo), preserving Root integration first.
  // Package tests include heavy cold builds; serialize packages without changing assertions/timeouts.
  const commands = ['locale:check', 'typecheck', 'lint', 'test', 'build', 'budget:check'];
  for (const command of commands) {
    report(`\nChecking ${command}`);
    const result = spawn('pnpm', command === 'test' ? [command, '--concurrency=1'] : [command], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runChecks({ root: process.cwd(), workspaceOnly: process.argv.includes('--workspace-only') });
}
