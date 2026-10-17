import { PendingOverlay } from '@niubu/layout-ui';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import { useOptionalPageTabs } from './context';
import { useInteractionState } from '@niubu/stores';
const UnsavedGuard = lazy(() =>
  import('@niubu/common-ui/unsaved-guard').then(module => ({ default: module.UnsavedGuard })),
);

/** Router-specific blocking stays in the routing layer; patterns and domains never read Router state. */

export function NavigationGuard({ description }: { description?: ReactNode } = {}) {
  const { dirty, navigationAllowed } = useInteractionState();
  const tabs = useOptionalPageTabs();
  const attempt = useRef<{ key: string; token: unknown; generation: number }>({ key: '', token: null, generation: 0 });
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation, historyAction }) => {
      tabs?.observeAttempt(nextLocation);
      const capacityAllowed = tabs?.preflight(nextLocation, historyAction) ?? true;
      attempt.current = {
        key: nextLocation.key,
        token: nextLocation.state?.[tabs?.runtime.intentStateKey ?? ''],
        generation: attempt.current.generation + 1,
      };
      if (!capacityAllowed) return true;
      return (
        dirty &&
        !navigationAllowed() &&
        (currentLocation.key !== nextLocation.key ||
          currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search ||
          currentLocation.hash !== nextLocation.hash)
      );
    },
    [dirty, navigationAllowed, tabs],
  );
  const blocker = useBlocker(shouldBlock);
  useEffect(() => {
    if (blocker.state === 'blocked' && tabs?.capacityKey === blocker.location.key) blocker.reset();
  }, [blocker, tabs?.capacityKey]);
  if (blocker.state !== 'blocked' || tabs?.capacityKey === blocker.location.key) return null;
  const captured = { key: blocker.location.key, token: blocker.location.state?.[tabs?.runtime.intentStateKey ?? ''] };
  const current = () =>
    blocker.state === 'blocked' &&
    attempt.current.key === blocker.location.key &&
    (!tabs || tabs.isCurrentAttempt(captured.key, captured.token));
  const stay = () => {
    if (current()) {
      attempt.current = { ...attempt.current, key: '' };
      tabs?.cancel();
      blocker.reset();
    }
  };
  const leave = () => {
    if (current()) {
      attempt.current = { ...attempt.current, key: '' };
      blocker.proceed();
    }
  };
  return (
    <Suspense fallback={<PendingGuard onStay={stay} />}>
      <UnsavedGuard open={blocker.state === 'blocked'} onStay={stay} onLeave={leave} description={description} />
    </Suspense>
  );
}

/** Capture the pending intent's focus; loaded confirmation retains the original AlertDialog owner. */
function PendingGuard({ onStay }: { onStay: () => void }) {
  const [previousFocus] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  return (
    <PendingOverlay
      onCancel={() => {
        const active = document.activeElement;
        onStay();
        if (
          previousFocus?.isConnected &&
          (active === previousFocus ||
            active === document.body ||
            !(active instanceof HTMLElement) ||
            !active.isConnected)
        )
          previousFocus.focus({ preventScroll: true });
      }}
    />
  );
}
