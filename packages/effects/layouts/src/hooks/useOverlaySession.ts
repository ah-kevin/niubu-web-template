import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OverlayFocusSettlementContext } from '../routing/context';
function canFocus(target: HTMLElement | null): target is HTMLElement {
  if (
    !target?.isConnected ||
    target === document.body ||
    target.closest('[inert],[aria-hidden="true"],[hidden]') ||
    target.hasAttribute('disabled') ||
    getComputedStyle(target).visibility === 'hidden'
  )
    return false;
  for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
    if (getComputedStyle(ancestor).display === 'none') return false;
  }
  return true;
}
/** A route/context generation owns lazy completion, cancellation, and focus return. */
export function useOverlaySession(sessionKey: unknown = '', fallback?: () => HTMLElement | null) {
  const [session, setSession] = useState({ key: sessionKey, open: false, epoch: 0 });
  const beginFocusReturn = useContext(OverlayFocusSettlementContext);
  const returning = useRef<{ epoch: number; surface: HTMLElement | null; release(): void } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const focusedAtOpen = useRef<HTMLElement | null>(null);
  const lifetime = useRef({ active: true, epoch: 0, restore: 0, opened: false });
  if (session.key !== sessionKey) setSession({ key: sessionKey, open: false, epoch: session.epoch + 1 });
  useLayoutEffect(() => {
    returning.current?.release();
    returning.current = null;
    if (lifetime.current.epoch !== session.epoch) lifetime.current.opened = false;
    lifetime.current.epoch = session.epoch;
    lifetime.current.restore = 0;
  }, [session.epoch, sessionKey, beginFocusReturn]);
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
      owner.epoch++;
      owner.restore = 0;
      owner.opened = false;
      returning.current?.release();
      returning.current = null;
    };
  }, []);
  const valid = () => lifetime.current.active && lifetime.current.epoch === session.epoch && session.key === sessionKey;
  const returnFocus = () => {
    if (!valid() || lifetime.current.restore !== session.epoch) return;
    const finish = () => {
      if (returning.current?.epoch !== session.epoch) return;
      returning.current.release();
      returning.current = null;
      lifetime.current.restore = 0;
    };
    // Shortcut callers may ask before the close render; the actual unmount callback settles the handoff.
    if (returning.current?.surface?.isConnected && returning.current.surface.dataset.state === 'open') return;
    try {
      if (document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]')) return;
      const target = [trigger.current, fallback?.() ?? null, document.getElementById('main-content')].find(canFocus);
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // A newer focus choice wins over the retired dialog's asynchronous cleanup.
      if (
        canFocus(active) &&
        active !== target &&
        active !== focusedAtOpen.current &&
        !active.closest(
          '[data-radix-focus-guard],[role="dialog"][data-state="closed"],[role="alertdialog"][data-state="closed"]',
        )
      )
        return;
      target?.focus({ preventScroll: true });
    } finally {
      finish();
    }
  };
  const close = (restore = true) => {
    if (!valid()) return;
    if (!restore) {
      returning.current?.release();
      returning.current = null;
      lifetime.current.restore = 0;
    }
    if (!lifetime.current.opened) return;
    lifetime.current.opened = false;
    if (restore && beginFocusReturn) {
      const id = trigger.current?.getAttribute('aria-controls');
      const surface =
        (id && document.getElementById(id)) ||
        document.activeElement?.closest<HTMLElement>('[role="dialog"],[role="alertdialog"]') ||
        null;
      returning.current = { epoch: session.epoch, surface, release: beginFocusReturn() };
    }
    lifetime.current.restore = restore ? session.epoch : 0;
    setSession(previous => ({ ...previous, open: false }));
  };
  const openOverlay = (target?: HTMLElement | null) => {
    if (!valid()) return;
    returning.current?.release();
    returning.current = null;
    const epoch = lifetime.current.epoch + 1;
    lifetime.current.opened = true;
    lifetime.current.epoch = epoch;
    lifetime.current.restore = 0;
    focusedAtOpen.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trigger.current = target ?? focusedAtOpen.current;
    setSession({ key: sessionKey, open: true, epoch });
  };
  return { open: session.key === sessionKey && session.open, openOverlay, close, returnFocus, epoch: session.epoch };
}
