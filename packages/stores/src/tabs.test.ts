import { describe, expect, it, vi } from 'vitest';
import { createTabStore, type PageTab } from './tabs';
const tab = (key: string, pinned = false): PageTab => ({ key, routeId: key, href: `/${key}`, restoreHref: `/${key}`, scopeKey: 'workspace:a', pinned, refreshNonce: 0 });
describe('per-app approved tab mutations', () => {
  it('keeps stable frozen snapshots and updates an existing href without losing pin or refresh', () => {
    const s = createTabStore({ home: tab('home') });
    s.open(tab('a')); s.pin('a', true); s.refresh('a');
    s.open({ ...tab('a'), href: '/a?q=new' });
    expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['home', 'a']);
    expect(s.getSnapshot().tabs[1]).toMatchObject({ href: '/a?q=new', pinned: true, refreshNonce: 1 });
    expect(Object.isFrozen(s.getSnapshot().tabs[1])).toBe(true);
    const before = s.getSnapshot(); s.pin('missing', true); expect(s.getSnapshot()).toBe(before);
  });
  it('protects the authorized home and refuses the last page when there is no home', () => {
    const s = createTabStore({ home: null }); s.open(tab('a'));
    expect(s.close('a')).toBe(false); expect(s.getSnapshot().activeKey).toBe('a');
    s.setHome(tab('home')); expect(s.close('home')).toBe(false);
    s.setHome(null); expect(s.getSnapshot().homeKey).toBeNull();
  });
  it('falls back to MRU and closes a batch in a single publish, preserving pinned pages', () => {
    const s = createTabStore({ home: tab('home') });
    s.open(tab('a')); s.open(tab('b')); s.open(tab('c')); s.activate('a'); s.activate('c');
    expect(s.fallback(['c'])?.key).toBe('a');
    const notify = vi.fn(); s.subscribe(notify);
    expect(s.commit({ closeKeys: ['b', 'c', 'home'], destination: tab('a') })).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['home', 'a']);
  });
  it('pins into a leading segment and rejects cross-segment and invalid ordering', () => {
    const s = createTabStore({ home: tab('home') }); s.open(tab('a')); s.open(tab('b')); s.open(tab('c'));
    s.pin('b', true); expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['home', 'b', 'a', 'c']);
    expect(s.reorder(['home', 'a', 'b', 'c'])).toBe(false);
    expect(s.reorder(['b', 'home', 'c', 'a'])).toBe(true);
    expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['b', 'home', 'c', 'a']);
    expect(s.reorder(['b', 'home', 'c', 'c'])).toBe(false);
  });
  it('rejects explicit capacity opens without safe victims but retains validated direct pages as overflow', () => {
    const s = createTabStore({ home: tab('home'), maxCount: 1 });
    expect(s.canOpen(tab('a'))).toBe(false); expect(s.open(tab('a'), 'ui')).toBe(false);
    expect(s.open(tab('a'), 'commit')).toBe(true); expect(s.getSnapshot().overflow).toBe(true);
    s.configure({ maxCount: 0 }); expect(s.getSnapshot().overflow).toBe(false);
  });
  it('evicts only safe inactive LRU pages and protects dirty and draft owners', () => {
    const protectedKeys = new Set(['a']);
    const s = createTabStore({ home: null, maxCount: 2, isProtected: key => protectedKeys.has(key) });
    s.open(tab('a')); s.open(tab('b')); expect(s.canOpen(tab('c'))).toBe(false);
    protectedKeys.clear(); expect(s.open(tab('c'), 'ui')).toBe(true);
    expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['b', 'c']);
  });
  it('disables MRU fallback when visitHistory is off and never clears drafts on close', () => {
    const s = createTabStore({ home: null, visitHistory: false });
    s.open(tab('a')); s.open(tab('b')); s.open(tab('c')); s.activate('a');
    expect(s.getSnapshot().visitOrder).toEqual([]); expect(s.fallback(['a'])?.key).toBe('b');
  });
  it('checks revision before an atomic commit and ignores all mutations after disposal', () => {
    const s = createTabStore({ home: tab('home') }); s.open(tab('a')); const revision = s.getSnapshot().revision;
    s.pin('a', true); expect(s.commit({ closeKeys: ['a'], destination: tab('home'), expectedRevision: revision })).toBe(false);
    s.setMaximized(true); expect(s.getSnapshot().contentMaximized).toBe(true);
    s.dispose(); const snapshot = s.getSnapshot(); s.open(tab('b')); s.setMaximized(false); expect(s.getSnapshot()).toBe(snapshot);
  });
});
it('keeps capacity LRU independent of disabled visit history and user reordering', () => {
  const s = createTabStore({ home: null, maxCount: 3, visitHistory: false });
  s.open(tab('a')); s.open(tab('b')); s.open(tab('c')); s.activate('a'); s.activate('c');
  s.reorder(['a', 'c', 'b']); s.open(tab('d'), 'ui');
  expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['a', 'c', 'd']);
  expect(s.getSnapshot().visitOrder).toEqual([]);
});
it('restores a validated collection atomically without choosing a cached active page', () => {
  const s = createTabStore({ home: null }); const notify = vi.fn(); s.subscribe(notify);
  s.restore([tab('a'), { ...tab('b'), pinned: true }]);
  expect(s.getSnapshot().activeKey).toBeNull(); expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['b', 'a']); expect(notify).toHaveBeenCalledTimes(1);
  s.open(tab('c')); const active = s.getSnapshot().activeKey; s.restore([tab('d')]); expect(s.getSnapshot().activeKey).toBe(active);
});
it('stably keeps other pinned pages first when a different scope replaces the authorized home', () => {
  const s = createTabStore({ home: tab('home-a') }); s.open(tab('p')); s.pin('p', true); s.open(tab('current'));
  const activeKey = s.getSnapshot().activeKey;
  s.setHome(tab('home-b'));
  expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['home-b', 'p', 'home-a', 'current']);
  expect(s.getSnapshot().tabs.map(t => t.pinned)).toEqual([true, true, false, false]);
  expect(s.getSnapshot().activeKey).toBe(activeKey);
});
it('stably keeps remaining pinned pages first when authorized home is cleared without changing current', () => {
  const s = createTabStore({ home: tab('home') }); s.open(tab('p')); s.pin('p', true); s.open(tab('current'));
  const activeKey = s.getSnapshot().activeKey;
  s.setHome(null);
  expect(s.getSnapshot().tabs.map(t => t.key)).toEqual(['p', 'home', 'current']);
  expect(s.getSnapshot().tabs.map(t => t.pinned)).toEqual([true, false, false]);
  expect(s.getSnapshot().homeKey).toBeNull(); expect(s.getSnapshot().activeKey).toBe(activeKey);
});
