import { expect, it } from 'vitest';
import { createTabStore, type PageTab } from './tabs';
import { planTabIntent } from './tab-intent';

const tab = (key: string, pinned = false): PageTab => ({ key, routeId: key, href: `/${key}`, restoreHref: `/${key}`, scopeKey: null, pinned, refreshNonce: 0 });
it('protects pinned and last pages while choosing the last visited remaining destination', () => {
  const store = createTabStore({ home: tab('home', true) });
  store.open(tab('a'));
  store.open(tab('b'));
  store.activate('a');
  expect(planTabIntent({ type: 'close', key: 'home' }, store.getSnapshot()).reason).toBe('protected-page');
  const plan = planTabIntent({ type: 'close', key: 'a' }, store.getSnapshot());
  expect(plan.allowed).toBe(true);
  expect(plan.closeKeys).toEqual(['a']);
  expect(plan.destination?.key).toBe('b');
  expect(plan.expectedRevision).toBe(store.getSnapshot().revision);
  const only = createTabStore({ home: null });
  only.open(tab('only'));
  expect(planTabIntent({ type: 'close', key: 'only' }, only.getSnapshot()).reason).toBe('last-page');
});
