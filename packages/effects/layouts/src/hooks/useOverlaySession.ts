import { useEffect, useLayoutEffect, useRef, useState } from 'react';
function canFocus(target: HTMLElement | null): target is HTMLElement {
  return Boolean(
    target?.isConnected &&
    target !== document.body &&
    !target.closest('[inert],[aria-hidden="true"],[hidden]') &&
    !target.hasAttribute('disabled') &&
    getComputedStyle(target).display !== 'none' &&
    getComputedStyle(target).visibility !== 'hidden',
  );
}
/** A route/context generation owns lazy completion, cancellation, and focus return. */
export function useOverlaySession(sessionKey: unknown = '', fallback?: () => HTMLElement | null) {
  const [session, setSession] = useState({ key: sessionKey, open: false, epoch: 0 });
  const trigger = useRef<HTMLElement | null>(null);
  const lifetime = useRef({ active: true, epoch: 0, restore: 0 });
  if (session.key !== sessionKey) setSession({ key: sessionKey, open: false, epoch: session.epoch + 1 });
  useLayoutEffect(() => {
    lifetime.current.epoch = session.epoch;
    lifetime.current.restore = 0;
  }, [session.epoch, sessionKey]);
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
      owner.epoch++;
      owner.restore = 0;
    };
  }, []);
  const valid = () => lifetime.current.active && lifetime.current.epoch === session.epoch && session.key === sessionKey;
  const returnFocus = () => {
    if (!valid() || lifetime.current.restore !== session.epoch) return;
    if (document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]')) return;
    const target = [trigger.current, fallback?.() ?? null, document.getElementById('main-content')].find(canFocus);
    target?.focus();
  };
  const close = (restore = true) => {
    if (!valid()) return;
    lifetime.current.restore = restore ? session.epoch : 0;
    setSession(previous => ({ ...previous, open: false }));
  };
  const openOverlay = (target?: HTMLElement | null) => {
    if (!valid()) return;
    const epoch = lifetime.current.epoch + 1;
    lifetime.current.epoch = epoch;
    lifetime.current.restore = 0;
    trigger.current = target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSession({ key: sessionKey, open: true, epoch });
  };
  return { open: session.key === sessionKey && session.open, openOverlay, close, returnFocus, epoch: session.epoch };
}
