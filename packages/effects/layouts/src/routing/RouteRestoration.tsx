import { useCallback, useLayoutEffect, useInsertionEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import type { ResolvedPageDescriptor } from '@niubu/stores';
import { ScrollCommitContext, type PageRoutingRuntime } from './context';
/** One numeric, in-memory document owner. Destination effects wait for the real content commit. */
export function RouteRestoration({
  children,
  runtime,
}: {
  children?: ReactNode;
  runtime: Pick<PageRoutingRuntime, 'resolveTab' | 'isContentRoute'>;
}) {
  const location = useLocation(),
    navigationType = useNavigationType();
  const live = useRef({ location, navigationType, runtime });
  useInsertionEffect(() => {
    live.current = { location, navigationType, runtime };
  }, [location, navigationType, runtime]);
  const committed = useRef<{ pageKey: string; address: string; locationKey: string } | null>(null);
  const entries = useRef(new Map<string, number>()),
    destinations = useRef(new Map<string, number>());
  const restore = useCallback((pageKey: string, address: string, locationKey: string) => {
    if (locationKey !== live.current.location.key) return;
    const previous = committed.current,
      scroll = document.scrollingElement ?? document.documentElement;
    if (previous?.locationKey === locationKey && previous.pageKey === pageKey && previous.address === address) return;
    const different = previous?.pageKey !== pageKey;
    if (different || live.current.navigationType === 'POP')
      scroll.scrollTop =
        entries.current.get(locationKey) ?? destinations.current.get(JSON.stringify([pageKey, address])) ?? 0;
    // A late content commit must not steal an active modal's focus or input selection.
    const focusedOverlay = document.activeElement?.closest(
      '[role="dialog"]:not([data-state="closed"]),[role="alertdialog"]:not([data-state="closed"])',
    );
    if (different && !focusedOverlay?.isConnected)
      document.getElementById('main-content')?.focus({ preventScroll: true });
    committed.current = { pageKey, address, locationKey };
  }, []);
  const commit = useCallback(
    (descriptor: ResolvedPageDescriptor) => {
      const tab = live.current.runtime.resolveTab(descriptor);
      if (tab) restore(tab.key, descriptor.href, descriptor.locationKey);
    },
    [restore],
  );
  useLayoutEffect(() => {
    const historyEntries = entries.current,
      pageDestinations = destinations.current;
    if (!runtime.isContentRoute(location))
      restore('@' + location.pathname, location.pathname + location.search + location.hash, location.key);
    return () => {
      const previous = committed.current;
      if (previous?.locationKey !== location.key) return;
      const scroll = document.scrollingElement ?? document.documentElement;
      historyEntries.set(previous.locationKey, scroll.scrollTop);
      pageDestinations.set(JSON.stringify([previous.pageKey, previous.address]), scroll.scrollTop);
    };
  }, [location, restore, runtime]);
  return <ScrollCommitContext value={commit}>{children}</ScrollCommitContext>;
}
