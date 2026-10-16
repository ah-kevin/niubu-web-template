import { describe, expect, it, vi } from 'vitest';
import { createAppStores } from './instance';
const context = {
  scope: { kind: 'region' as const, id: 'region-a' },
  businessDate: '2026-10-11',
  timeZone: 'Asia/Shanghai',
};
describe('app stores lifetime', () => {
  it('isolates UI, workspace, session and cloned tuple draft values', () => {
    const a = createAppStores({ identityKey: 'a', readContext: context });
    const b = createAppStores({ identityKey: 'b', readContext: context });
    const draft = { value: 'first' };
    a.ui.update({ mobileOpen: true });
    a.workspace.setReadContext({ ...context, scope: { kind: 'region', id: 'region-b' } });
    a.interaction.writeDraft('region-a', 'case', draft);
    draft.value = 'mutated';
    a.interaction.setDirty('editor', true);
    expect(a.interaction.readDraft('region-a', 'case')).toEqual({ value: 'first' });
    expect(a.getSnapshot().ui.mobileOpen).toBe(true);
    expect(a.getSnapshot().workspace.readContext?.scope.id).toBe('region-b');
    expect(b.interaction.readDraft('region-a', 'case')).toBeUndefined();
    expect(b.getSnapshot()).toMatchObject({
      session: { identityKey: 'b' },
      ui: { mobileOpen: false },
      workspace: { readContext: context },
      interaction: { dirty: false },
    });
    expect(a.interaction.readDraft('region', 'a:case')).toBeUndefined();
    a.dispose();
    b.dispose();
  });
  it('publishes stable snapshots and clears drafts, listeners and guard approval on disposal', () => {
    const stores = createAppStores({ identityKey: 'a', readContext: context });
    const changed = vi.fn();
    stores.subscribe(changed);
    const initial = stores.getSnapshot();
    stores.interaction.setDirty('a', false);
    expect(stores.getSnapshot()).toBe(initial);
    stores.interaction.setDirty('a', true);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(() =>
      stores.interaction.runWithoutGuard(() => {
        expect(stores.interaction.navigationAllowed()).toBe(true);
        throw Error('action');
      }),
    ).toThrow('action');
    expect(stores.interaction.navigationAllowed()).toBe(false);
    stores.interaction.writeDraft('s', 'd', 1);
    stores.dispose();
    stores.dispose();
    changed.mockClear();
    stores.ui.update({ mobileOpen: true });
    stores.interaction.writeDraft('s', 'd', 2);
    expect(changed).not.toHaveBeenCalled();
    expect(stores.interaction.readDraft('s', 'd')).toBeUndefined();
    expect(stores.getSnapshot().session.disposed).toBe(true);
  });
});
describe('page-scoped interaction ownership', () => {
  it('keeps draft tuple semantics, protects inactive drafts and isolates mounted dirty cleanup', () => {
    const s = createAppStores({ identityKey: 'a', readContext: context });
    const a = s.interaction.forPage('a'), b = s.interaction.forPage('b');
    a.setDirty('editor', true); b.setDirty('editor', true); a.setDirty('editor', false);
    expect(s.interaction.getSnapshot().dirty).toBe(true);
    b.writeDraft('scope', 'draft', { value: 1 }); b.setDirty('editor', false);
    expect(s.interaction.getSnapshot().dirty).toBe(false);
    expect(s.interaction.isPageProtected('b')).toBe(true);
    expect(a.readDraft('scope', 'draft')).toEqual({ value: 1 });
    a.removeDraft('scope', 'draft'); expect(s.interaction.isPageProtected('b')).toBe(false);
    expect(s.interaction.forPage('a')).toBe(a);
    expect(s.tabs).toBeDefined();
    s.dispose(); expect(s.tabs.getSnapshot().tabs).toEqual([]);
  });
});
