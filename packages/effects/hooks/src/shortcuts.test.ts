import { expect, it, vi } from 'vitest';
import { createShortcutRuntime } from './shortcuts';
const preferences = { enabled: true, globalSearch: true, globalPreferences: true, globalEscape: true };
class Key extends Event {
  key = 'k';
  ctrlKey = false;
  metaKey = false;
  altKey = false;
  shiftKey = false;
  repeat = false;
  isComposing = false;
  constructor(patch: Partial<Key> = {}) {
    super('keydown', { cancelable: true });
    Object.assign(this, patch);
  }
  getModifierState() {
    return false;
  }
}
it('uses the platform modifier, rejects accidental variants and uses updated callbacks', () => {
  const target = new EventTarget(),
    search = vi.fn(),
    display = vi.fn(),
    cancel = vi.fn(() => true);
  const runtime = createShortcutRuntime({
    target,
    platform: 'MacIntel',
    preferences,
    actions: { search, preferences: display, cancelOverlay: cancel },
  });
  target.dispatchEvent(new Key({ metaKey: true }));
  expect(search).toHaveBeenCalledTimes(1);
  for (const patch of [
    { ctrlKey: true },
    { metaKey: true, ctrlKey: true },
    { metaKey: true, altKey: true },
    { metaKey: true, shiftKey: true },
    { metaKey: true, repeat: true },
    { metaKey: true, isComposing: true },
  ])
    target.dispatchEvent(new Key(patch));
  expect(search).toHaveBeenCalledTimes(1);
  const prevented = new Key({ metaKey: true });
  prevented.preventDefault();
  target.dispatchEvent(prevented);
  expect(search).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Key({ metaKey: true, key: ',' }));
  expect(display).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Key({ key: 'Escape' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  const next = vi.fn();
  runtime.update({
    platform: 'Linux',
    preferences: { ...preferences, globalEscape: false },
    actions: { search: next, preferences: display, cancelOverlay: cancel },
  });
  target.dispatchEvent(new Key({ ctrlKey: true }));
  expect(next).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Key({ key: 'Escape' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  runtime.dispose();
  target.dispatchEvent(new Key({ ctrlKey: true }));
  expect(next).toHaveBeenCalledTimes(1);
});
it('ignores composed editor paths but still allows Escape in the search input', () => {
  const target = new EventTarget(),
    search = vi.fn(),
    cancel = vi.fn(() => true);
  const runtime = createShortcutRuntime({
    target,
    platform: 'Linux',
    preferences,
    actions: { search, preferences: vi.fn(), cancelOverlay: cancel },
  });
  const editor = {
    nodeType: 1,
    tagName: 'SPAN',
    getAttribute: (key: string) => (key === 'contenteditable' ? 'true' : null),
  };
  const event = new Key({ ctrlKey: true });
  event.composedPath = () => [editor as unknown as EventTarget, target];
  target.dispatchEvent(event);
  expect(search).not.toHaveBeenCalled();
  const escape = new Key({ key: 'Escape' });
  escape.composedPath = event.composedPath;
  target.dispatchEvent(escape);
  expect(cancel).toHaveBeenCalledTimes(1);
  runtime.dispose();
  runtime.dispose();
});
