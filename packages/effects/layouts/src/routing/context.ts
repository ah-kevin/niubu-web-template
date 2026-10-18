import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { ScopeRef } from '@niubu/core-typings';
import type { Location } from 'react-router-dom';
import type {
  PageLocation,
  PageTypeReport,
  PageTab,
  ResolvedPageDescriptor,
  TabIntent,
  TabSessionIdentity,
} from '@niubu/stores';
import { useAppStores } from '@niubu/stores/react';
import type { SessionStoragePort } from '@niubu/hooks';

export type PageRoutingRuntime = Readonly<{
  describe(location: PageLocation, report?: PageTypeReport): ResolvedPageDescriptor;
  resolveTab(descriptor: ResolvedPageDescriptor): PageTab | null;
  home(scope: ScopeRef | null): ResolvedPageDescriptor;
  renderTab(tab: PageTab): Readonly<{ label: string; icon?: ReactNode }>;
  isContentRoute(location: PageLocation): boolean;
  intentStateKey: string;
}>;
export type TabSessionOptions = Readonly<{
  port: SessionStoragePort;
  identity: TabSessionIdentity;
  storageNamespace: string;
}>;
export type PageTabsController = Readonly<{
  runtime: PageRoutingRuntime;
  request(intent: TabIntent): void;
  commit(descriptor: ResolvedPageDescriptor): void;
  cancel(): void;
  observeAttempt(next: Location): void;
  isCurrentAttempt(key: string, token: unknown): boolean;
  validate(href: string): PageTab | null;
  status: string | null;
  capacityKey: string | null;
  preflight(next: Location, historyAction: string): boolean;
}>;
export const ControllerContext = createContext<PageTabsController | null>(null);
export const ScrollCommitContext = createContext<((descriptor: ResolvedPageDescriptor) => void) | null>(null);
/** Private entry-scoped handoff while a closing overlay settles its existing focus return. */
export const OverlayFocusSettlementContext = createContext<(() => () => void) | null>(null);
export type DescriptorChannel = {
  resolve(view?: string, status?: ResolvedPageDescriptor['status']): ResolvedPageDescriptor;
  resolveTab(descriptor: ResolvedPageDescriptor): PageTab | null;
  report(descriptor: ResolvedPageDescriptor): void;
  pageKey: string;
};
export const DescriptorContext = createContext<DescriptorChannel | null>(null);
export const useOptionalPageTabs = () => useContext(ControllerContext);
export const usePageScrollCommit = () => useContext(ScrollCommitContext);
export function usePageTabs() {
  const controller = useOptionalPageTabs();
  const stores = useAppStores();
  if (!controller) throw Error('Page tabs controller is required');
  const snapshot = useSyncExternalStore(stores.tabs.subscribe, stores.tabs.getSnapshot, stores.tabs.getSnapshot);
  return { ...controller, snapshot };
}
export const pageIntentStateKey = (storageNamespace: string) => `__${storageNamespace}_page_intent_v1`;
