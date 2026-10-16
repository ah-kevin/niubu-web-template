import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  useInteractionState,
  type PageLocation,
  type PageTypeReport,
  type PageTab,
  type ResolvedPageDescriptor,
} from '@niubu/stores';
import { useAppStores, PageInteractionBinding } from '@niubu/stores/react';
import type { ReadContext, ScopeRef } from '@niubu/core-typings';
import { RoutePresentation, RoutePending, RouteMotion } from './RoutePresentation';
import { PageDescriptorBoundary } from './PageDescriptorBoundary';

export type FrameResolution = Readonly<{
  title: string;
  kind: 'public' | 'account' | 'protected';
  context: ReadContext | null;
  scope: ScopeRef | null;
  stateContent?: ReactNode;
}>;
export type RouteFrameProps = Readonly<{
  registered?: ComponentType;
  path: string;
  appTitle: string;
  dirty?: boolean;
  resolveFrame(location: PageLocation): FrameResolution;
  describe(location: PageLocation, context: ReadContext | null, report?: PageTypeReport): ResolvedPageDescriptor;
  resolveTab(descriptor: ResolvedPageDescriptor): PageTab | null;
  requiresReport(location: PageLocation): boolean;
  renderShell(
    kind: FrameResolution['kind'],
    children: ReactNode,
    resolution: FrameResolution,
    dirty: boolean,
  ): ReactNode;
  renderFallback(path: string): ReactNode;
  wrapContent?(children: ReactNode, context: ReadContext | null): ReactNode;
}>;
/** Generic route lifecycle; the app supplies policy, data providers and shell composition. */
export function RouteFrame({
  registered: Registered,
  path,
  appTitle,
  dirty: appDirty,
  resolveFrame,
  describe,
  resolveTab,
  requiresReport,
  renderShell,
  renderFallback,
  wrapContent,
}: RouteFrameProps) {
  const location = useLocation();
  const { dirty } = useInteractionState();
  const stores = useAppStores();
  const resolution = useMemo(() => resolveFrame(location), [resolveFrame, location]);
  const [resolvedPage, setResolvedPage] = useState<ResolvedPageDescriptor | null>(null);
  const resolveDescriptor = useCallback(
    (effectiveView?: string, status?: ResolvedPageDescriptor['status']) =>
      describe(location, resolution.context, {
        effectiveView,
        status,
        locationKey: location.key,
        commitToken: location.key,
      }),
    [describe, location, resolution.context],
  );
  const descriptor = useMemo(() => resolveDescriptor(), [resolveDescriptor]);
  const previousMatches =
    resolvedPage?.status === 'ready' &&
    resolvedPage.family === descriptor.family &&
    resolvedPage.entityPath === descriptor.entityPath &&
    JSON.stringify(resolvedPage.scope) === JSON.stringify(descriptor.scope);
  const currentDescriptor =
    resolvedPage?.locationKey === location.key && resolvedPage.status === 'ready' ? resolvedPage : descriptor;
  const page = resolveTab(currentDescriptor) ?? (previousMatches ? resolveTab(resolvedPage) : null);
  const pageKey =
    page?.key ?? JSON.stringify([descriptor.family, descriptor.entityPath, descriptor.scope, 'unresolved']);
  const currentPageKey = page?.key;
  const getNonce = useCallback(
    () =>
      stores.tabs.getSnapshot().tabs.find(tab => tab.key === currentPageKey || tab.href === descriptor.href)
        ?.refreshNonce ?? 0,
    [stores, currentPageKey, descriptor.href],
  );
  const nonce = useSyncExternalStore(stores.tabs.subscribe, getNonce, getNonce);
  const onResolved = useCallback(
    (next: ResolvedPageDescriptor) =>
      setResolvedPage(previous =>
        previous?.locationKey === next.locationKey &&
        previous.status === next.status &&
        previous.effectiveView === next.effectiveView &&
        previous.href === next.href
          ? previous
          : next,
      ),
    [],
  );
  const present = (children: ReactNode) => (
    <RoutePresentation title={resolution.title} appTitle={appTitle} generation={`${location.key}:${nonce}`}>
      {children}
    </RoutePresentation>
  );
  if (resolution.stateContent !== undefined)
    return present(renderShell(resolution.kind, resolution.stateContent, resolution, !!appDirty || dirty));
  const body = (
    <RouteMotion identity={pageKey} refreshNonce={nonce}>
      <Suspense key={path} fallback={<RoutePending />}>
        <PageDescriptorBoundary
          descriptor={descriptor}
          pageKey={pageKey}
          onResolved={onResolved}
          resolve={resolveDescriptor}
          resolveTab={resolveTab}
          requiresReport={requiresReport(location)}
        >
          {Registered ? <Registered /> : renderFallback(path)}
        </PageDescriptorBoundary>
      </Suspense>
    </RouteMotion>
  );
  if (resolution.kind !== 'protected')
    return present(renderShell(resolution.kind, body, resolution, !!appDirty || dirty));
  const content = (
    <PageInteractionBinding stores={stores} pageKey={pageKey}>
      {wrapContent ? wrapContent(body, resolution.context) : body}
    </PageInteractionBinding>
  );
  return present(
    renderShell(
      'protected',
      <div key={`${pageKey}:${nonce}`} className="page-tab-content">
        {content}
      </div>,
      resolution,
      !!appDirty || dirty,
    ),
  );
}
export function RouteErrorBoundary({
  title,
  appTitle,
  children,
}: {
  title: string;
  appTitle: string;
  children: ReactNode;
}) {
  return (
    <RoutePresentation title={title} appTitle={appTitle} generation="route-error">
      {children}
    </RoutePresentation>
  );
}
