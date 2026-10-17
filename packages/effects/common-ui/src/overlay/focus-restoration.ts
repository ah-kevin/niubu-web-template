/** Radix menus label their temporary surface with the stable opening control. */
export function captureOverlayFocus(ownerDocument: Document = document): HTMLElement | null {
  let target = ownerDocument.activeElement instanceof HTMLElement ? ownerDocument.activeElement : null;
  const visited = new Set<HTMLElement>();
  while (target && !visited.has(target)) {
    visited.add(target);
    const menu = target.closest('[role="menu"]');
    const trigger = menu
      ?.getAttribute('aria-labelledby')
      ?.split(/\s+/)
      .map(id => ownerDocument.getElementById(id))
      .find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          element.isConnected &&
          element.matches('button, [role="button"], [role="menuitem"]'),
      );
    if (!trigger) break;
    target = trigger;
  }
  return target;
}

/** Restore only neutral/retiring focus; another connected choice already owns focus. */
export function restoreOverlayFocus(target: HTMLElement | null | undefined, closingSurface?: EventTarget | null) {
  if (!target?.isConnected || target.matches(':disabled, [aria-disabled="true"]')) return;
  if (target.closest('[inert], [hidden], [aria-hidden="true"]')) return;
  const ownerDocument = target.ownerDocument;
  const current = ownerDocument.activeElement;
  const neutral = !current || current === ownerDocument.body || current === ownerDocument.documentElement;
  if (!neutral && current !== target && !(closingSurface instanceof Node && closingSurface.contains(current))) return;
  if (current !== target) target.focus({ preventScroll: true });
}
