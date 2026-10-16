import * as prettier from 'prettier';
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { cli, git, repository, rewriteMatching, safePath, sensitivePath } from './shared.ts';

function stagedPaths(bytes: Buffer) {
  const fields = new TextDecoder('utf-8', { fatal: true }).decode(bytes).split('\0');
  const paths: string[] = [];
  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    const source = fields[index++];
    const path = /^[RC]/.test(status) ? fields[index++] : source;
    if (!path || !/^[ACMRT]\d*$/.test(status)) throw new Error('Unexpected staged path record.');
    if (sensitivePath(source)) throw new Error(`Refusing a sensitive staged source: ${JSON.stringify(source)}`);
    paths.push(path);
  }
  return paths;
}

function quotePatchPath(path: string) {
  const escaped = Array.from(Buffer.from(path), byte => {
    if (byte === 0x22 || byte === 0x5c) return `\\${String.fromCharCode(byte)}`;
    if (byte < 0x20 || byte > 0x7e) return `\\${byte.toString(8).padStart(3, '0')}`;
    return String.fromCharCode(byte);
  }).join('');
  return `"${escaped}"`;
}

function formattingDiff(path: string, before: string, after: string) {
  const lines = (text: string) => (text ? text.replace(/\n$/, '').split('\n') : []);
  const oldLines = lines(before);
  const newLines = lines(after);
  const removed = oldLines.map(line => `-${line}`);
  const added = newLines.map(line => `+${line}`);
  if (before && !before.endsWith('\n')) removed.push('\\ No newline at end of file');
  if (after && !after.endsWith('\n')) added.push('\\ No newline at end of file');
  return [
    `--- ${quotePatchPath(`a/${path}`)}`,
    `+++ ${quotePatchPath(`b/${path}`)}`,
    `@@ -${oldLines.length ? 1 : 0},${oldLines.length} +${newLines.length ? 1 : 0},${newLines.length} @@`,
    ...removed,
    ...added,
    '',
  ].join('\n');
}

export async function runPreCommit(options: { root: string; gitDir?: string }): Promise<number> {
  try {
    const { root } = await repository(options.root, options.gitDir);
    const paths = stagedPaths(
      git(root, ['diff', '--cached', '--name-status', '-z', '--diff-filter=ACMRT', '--find-renames']),
    );
    if (!paths.length) return 0;
    const eslint = new ESLint({ cwd: root, fix: false });
    let failed = false;
    for (const path of paths) {
      const label = JSON.stringify(path);
      if (sensitivePath(path)) throw new Error(`Refusing a sensitive staged path: ${label}`);
      const absolute = await safePath(root, path, true);
      const entry = git(root, ['ls-files', '--stage', '-z', '--', path]).toString();
      const match = /^(100644|100755) ([0-9a-f]+) 0\t/.exec(entry);
      if (!match) throw new Error(`Refusing a non-regular staged entry: ${label}`);
      const blob = git(root, ['cat-file', 'blob', match[2]]);
      if (blob.includes(0)) continue;
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(blob);
      } catch {
        continue;
      }
      const info = await prettier.getFileInfo(absolute, {
        ignorePath: join(root, '.prettierignore'),
        resolveConfig: false,
      });
      if (!info.ignored && info.inferredParser) {
        const formatted = await prettier.format(text, {
          ...(await prettier.resolveConfig(absolute)),
          filepath: absolute,
        });
        if (formatted !== text) {
          failed = true;
          if (await rewriteMatching(root, path, blob, formatted)) {
            console.error(`Formatted ${label}; review and git add the result before retrying.`);
          } else {
            console.error(
              `Partial staging: ${label}; worktree untouched. Review this staged formatting diff:\n${formattingDiff(path, text, formatted)}`,
            );
          }
        }
      }
      if (!(await eslint.isPathIgnored(absolute))) {
        const results = await eslint.lintText(text, { filePath: absolute, warnIgnored: false });
        if (results.some(result => result.errorCount > 0)) {
          failed = true;
          console.error((await eslint.loadFormatter('stylish')).format(results));
        }
      }
    }
    return failed ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staged checks failed.');
    return 1;
  }
}

cli(import.meta.url, () => runPreCommit({ root: process.cwd() }));
