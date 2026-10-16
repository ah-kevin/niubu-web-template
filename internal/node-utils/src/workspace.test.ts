import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readWorkspace, workspaceOwner } from './index.ts';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
it('keeps root source governed after workspace globs activate, with nested tools owning their files', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'niubu-root-owner-')));
  roots.push(root);
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'internal/tool/src'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'legacy-app', private: true }));
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - internal/*\n');
  writeFileSync(join(root, 'internal/tool/package.json'), JSON.stringify({ name: 'tool', private: true }));
  writeFileSync(join(root, 'src/main.ts'), 'export const app = 1;');
  writeFileSync(join(root, 'internal/tool/src/index.ts'), 'export const tool = 1;');
  const graph = readWorkspace(root);
  expect(workspaceOwner(graph, join(root, 'src/main.ts'))?.name).toBe('legacy-app');
  expect(workspaceOwner(graph, join(root, 'internal/tool/src/index.ts'))?.name).toBe('tool');
});
