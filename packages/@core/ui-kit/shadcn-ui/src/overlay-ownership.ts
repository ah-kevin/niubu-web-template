import { useCallback, type Ref } from 'react';
import { usePortalInteractionKind } from './business-portal-boundary';

type Barrier = { kind: 'lock' | 'reauth'; element: HTMLElement; focusFallback(): HTMLElement };
type Owner = { kind: 'mounted' } | { kind: 'pending'; cancel: () => void } | Barrier;
type Stack = { entries: Owner[]; listener: EventListener; barrierListening: boolean };
const stacks = new WeakMap<EventTarget, Stack>();
const barrierEvents = ['pointerdown', 'pointerup', 'click', 'focusin'] as const;
function topBarrier(stack?: Stack): Barrier | undefined {
  return stack?.entries.findLast((entry): entry is Barrier => entry.kind === 'reauth') ?? stack?.entries.findLast((entry): entry is Barrier => entry.kind === 'lock');
}
function focusBarrier(barrier: Barrier) {
  if (!barrier.element.isConnected) return;
  const fallback = barrier.focusFallback();
  (fallback.isConnected && barrier.element.contains(fallback) ? fallback : barrier.element).focus({ preventScroll: true });
}
function intercept(target: EventTarget, event: Event) {
  const barrier = topBarrier(stacks.get(target));
  if (barrier) {
    const allowed = event.composedPath().includes(barrier.element);
    const key = event as KeyboardEvent;
    const reserved = event.type === 'keydown' && (key.key === 'Escape' || ((key.ctrlKey || key.metaKey) && ['k', ','].includes(key.key.toLowerCase())));
    if (!allowed || reserved) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type === 'focusin' && !allowed) focusBarrier(barrier);
    }
    return;
  }
  if (event.type === 'keydown') cancelTopPendingOverlay(target, event as KeyboardEvent);
}
function register(target: EventTarget, owner: Owner) {
  let stack = stacks.get(target);
  if (!stack) {
    const listener: EventListener = event => { intercept(target, event); };
    stack = { entries: [], listener, barrierListening: false };
    stacks.set(target, stack);
    target.addEventListener('keydown', listener, { capture: true });
  }
  stack.entries.push(owner);
  if (!stack.barrierListening && topBarrier(stack)) {
    for (const event of barrierEvents) target.addEventListener(event, stack.listener, { capture: true });
    stack.barrierListening = true;
  }
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const current = stacks.get(target);
    if (!current) return;
    const wasTop = topBarrier(current) === owner;
    current.entries = current.entries.filter(entry => entry !== owner);
    if (current.barrierListening && !topBarrier(current)) {
      for (const event of barrierEvents) target.removeEventListener(event, current.listener, { capture: true });
      current.barrierListening = false;
    }
    if (current.entries.length === 0) {
      target.removeEventListener('keydown', current.listener, { capture: true });
      stacks.delete(target);
    } else if (wasTop) {
      const next = topBarrier(current);
      if (next) queueMicrotask(() => { if (topBarrier(stacks.get(target)) === next) focusBarrier(next); });
    }
  };
}
/** Mounted Radix layers retain their own dismissal. Only a genuinely top pending owner intercepts. */
export function cancelTopPendingOverlay(target: EventTarget, event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.key !== 'Escape') return false;
  if (topBarrier(stacks.get(target))) {
    event.preventDefault(); event.stopImmediatePropagation(); return true;
  }
  const owner = stacks.get(target)?.entries.at(-1);
  if (owner?.kind !== 'pending') return false;
  event.preventDefault();
  event.stopPropagation();
  owner.cancel();
  return true;
}
export function registerPendingOverlay(target: EventTarget, cancel: () => void) {
  return register(target, { kind: 'pending', cancel });
}
/** Same target manager and same lifetime as the existing pending/mounted owners. */
export function registerInteractionBarrier(target: EventTarget, barrier: Barrier): () => void {
  return register(target, barrier);
}
function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') return ref(node);
  if (ref) ref.current = node;
}
/** Callback-ref lifetime tracks actual portal content, including StrictMode ref cleanup. */
export function useOverlayBoundaryRef<T extends HTMLElement>(forwardedRef?: Ref<T>, activeKey: unknown = true) {
  const kind = usePortalInteractionKind();
  return useCallback(
    (node: T | null) => {
      const target = node?.ownerDocument.defaultView;
      const unregister = target && node && activeKey !== false ? register(target, kind === 'business' ? { kind: 'mounted' } : { kind, element: node, focusFallback: () => node }) : () => {};
      const cleanup = assignRef(forwardedRef, node);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        unregister();
        if (typeof cleanup === 'function') cleanup();
        else assignRef(forwardedRef, null);
      };
    },
    [forwardedRef, activeKey, kind],
  );
}
