import { useCallback, useLayoutEffect, useMemo, useContext, type ReactNode } from 'react';
import type { PageTab, ResolvedPageDescriptor } from '@niubu/stores';
import { DescriptorContext, useOptionalPageTabs, usePageScrollCommit, type DescriptorChannel } from './context';

/** The channel keeps resolve/report paired for the same adapter metadata type. */
export function PageTypeReport({
  view,
  status = 'ready',
  children,
}: {
  view?: string;
  status?: ResolvedPageDescriptor['status'];
  children?: ReactNode;
}) {
  const channel = useContext(DescriptorContext);
  const descriptor = useMemo(() => channel?.resolve(view, status), [channel, view, status]);
  const key = descriptor ? channel?.resolveTab(descriptor)?.key : undefined;
  useLayoutEffect(() => {
    if (descriptor) channel?.report(descriptor);
  }, [channel, descriptor]);
  if (!channel || status === 'rejected') return children;
  if (status !== 'ready' || key !== channel.pageKey) return null;
  return children;
}
export function PageDescriptorBoundary<D extends ResolvedPageDescriptor>({
  descriptor,
  resolve,
  resolveTab,
  requiresReport,
  pageKey,
  onResolved,
  children,
}: {
  descriptor: D;
  resolve(view?: string, status?: D['status']): D;
  resolveTab(descriptor: ResolvedPageDescriptor): PageTab | null;
  requiresReport: boolean;
  pageKey: string;
  onResolved(descriptor: D): void;
  children: ReactNode;
}) {
  const controller = useOptionalPageTabs(),
    scrollCommit = usePageScrollCommit();
  const report = useCallback(
    (next: D) => {
      onResolved(next);
      if (next.status !== 'ready' || resolveTab(next)?.key === pageKey) {
        controller?.commit(next);
        scrollCommit?.(next);
      }
    },
    [onResolved, pageKey, resolveTab, controller, scrollCommit],
  );
  const channel: DescriptorChannel = useMemo(
    () => ({ resolve, resolveTab, report, pageKey }),
    [resolve, resolveTab, report, pageKey],
  );
  return (
    <DescriptorContext value={channel}>
      {children}
      {!requiresReport && <PageCommit descriptor={descriptor} />}
    </DescriptorContext>
  );
}
function PageCommit({ descriptor }: { descriptor: ResolvedPageDescriptor }) {
  const controller = useOptionalPageTabs(),
    scrollCommit = usePageScrollCommit();
  useLayoutEffect(() => {
    controller?.commit(descriptor);
    scrollCommit?.(descriptor);
  }, [controller, descriptor, scrollCommit]);
  return null;
}
