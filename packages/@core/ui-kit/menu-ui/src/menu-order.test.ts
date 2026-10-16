import { expect, it } from 'vitest';
import { normalizeMenuOrder, moveMenuItem, toggleMenuBranch } from './menu-order';
it('normalizes only sibling display IDs without changing the canonical input', () => {
  const ids = Object.freeze(['a', 'b', 'c']);
  expect(normalizeMenuOrder(ids, ['b', 'foreign', 'b'])).toEqual(['b', 'a', 'c']);
  expect(moveMenuItem(ids, 'c', -1)).toEqual(['a', 'c', 'b']);
  expect(moveMenuItem(ids, 'foreign', -1)).toEqual(ids);
  expect(ids).toEqual(['a', 'b', 'c']);
});
it('accordion closes only siblings and preserves independent ancestors and cousins', () => {
  const parents = { root: null, a: 'root', b: 'root', x: null, y: 'x' };
  expect(toggleMenuBranch(['root', 'a', 'x', 'y'], 'b', true, parents, true)).toEqual(['root', 'x', 'y', 'b']);
  expect(toggleMenuBranch(['root', 'a'], 'b', true, parents, false)).toEqual(['root', 'a', 'b']);
  expect(toggleMenuBranch(['root', 'a'], 'foreign', true, parents, true)).toEqual(['root', 'a']);
});
