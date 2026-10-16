import type { CorePreferences } from '@niubu/core-preferences';
export type ShortcutActions = Readonly<{
  search: () => void;
  preferences: () => void;
  cancelOverlay: (event: KeyboardEvent) => boolean;
}>;
export type ShortcutOptions = {
  target: EventTarget;
  platform: string;
  preferences: CorePreferences['shortcut'];
  actions: ShortcutActions;
};
export const usesMetaModifier = (platform: string) => /Mac|iPhone|iPad|iPod/i.test(platform);
export const shortcutHint = (platform: string, key: string) => `${usesMetaModifier(platform) ? '⌘' : 'Ctrl'} ${key}`;
function editing(event: KeyboardEvent): boolean {
  const path = event.composedPath?.() ?? [event.target];
  return path.some(item => {
    if (!item || typeof item !== 'object' || !('tagName' in item)) return false;
    const node = item as HTMLElement;
    return (
      /^(INPUT|TEXTAREA|SELECT)$/i.test(node.tagName) ||
      node.isContentEditable ||
      (node.getAttribute?.('contenteditable') !== null &&
        node.getAttribute?.('contenteditable') !== undefined &&
        node.getAttribute('contenteditable') !== 'false') ||
      node.getAttribute?.('role') === 'textbox' ||
      Boolean(node.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))
    );
  });
}
/** An injected, disposable per-app dispatcher. Native navigation and local overlay keys remain untouched. */
export function createShortcutRuntime(options: ShortcutOptions) {
  let current = options,
    disposed = false;
  const target = options.target;
  const keydown = (raw: Event) => {
    const event = raw as KeyboardEvent;
    if (
      disposed ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.getModifierState?.('AltGraph') ||
      !current.preferences.enabled
    )
      return;
    if (event.key === 'Escape') {
      if (
        current.preferences.globalEscape &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        current.actions.cancelOverlay(event)
      )
        event.preventDefault();
      return;
    }
    if (editing(event) || event.altKey || event.shiftKey) return;
    const modifier = usesMetaModifier(current.platform)
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (!modifier) return;
    if (event.key.toLowerCase() === 'k' && current.preferences.globalSearch) {
      event.preventDefault();
      current.actions.search();
    } else if (event.key === ',' && current.preferences.globalPreferences) {
      event.preventDefault();
      current.actions.preferences();
    }
  };
  target.addEventListener('keydown', keydown);
  return {
    update(next: Omit<ShortcutOptions, 'target'>) {
      if (!disposed) current = { ...next, target };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.removeEventListener('keydown', keydown);
    },
  };
}
