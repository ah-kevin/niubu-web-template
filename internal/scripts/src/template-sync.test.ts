import { expect, it } from 'vitest';
import { compareTrees, inSyncScope } from './template-sync';

const tree = (entries: Record<string, string>) => new Map(Object.entries(entries));

it('limits the comparison to the shared roots and the two byte-identical guides', () => {
  expect(inSyncScope('packages/effects/common-ui/src/a.ts')).toBe(true);
  expect(inSyncScope('apps/playground/src/main.tsx')).toBe(true);
  expect(inSyncScope('docs/guide/workflow.md')).toBe(true);
  expect(inSyncScope('docs/guide/README.md')).toBe(false);
  expect(inSyncScope('apps/other/src/main.tsx')).toBe(false);
});
it('reports differing and one-sided files, and passes when everything matches', () => {
  const clean = compareTrees(tree({ 'packages/a.ts': '1' }), tree({ 'packages/a.ts': '1' }), []);
  expect(clean).toMatchObject({ different: [], onlyLocal: [], onlyTemplate: [], unaccepted: 0, stale: [] });
  const drift = compareTrees(
    tree({ 'packages/a.ts': '1', 'packages/local.ts': 'x' }),
    tree({ 'packages/a.ts': '2', 'packages/new.ts': 'y' }),
    [],
  );
  expect(drift.different).toEqual(['packages/a.ts']);
  expect(drift.onlyLocal).toEqual(['packages/local.ts']);
  expect(drift.onlyTemplate).toEqual(['packages/new.ts']);
  expect(drift.unaccepted).toBe(3);
});
it('accepts declared divergences by exact path or directory prefix and flags stale declarations', () => {
  const result = compareTrees(
    tree({ 'internal/lint/a.ts': '1', 'internal/lint/b.ts': '1', 'packages/c.ts': '1' }),
    tree({ 'internal/lint/a.ts': '2', 'packages/c.ts': '1' }),
    ['internal/lint/', 'packages/c.ts', 'packages/gone.ts'],
  );
  expect(result.unaccepted).toBe(0);
  expect(result.accepted).toEqual(['internal/lint/a.ts', 'internal/lint/b.ts']);
  expect(result.stale).toEqual(['packages/c.ts', 'packages/gone.ts']);
});
