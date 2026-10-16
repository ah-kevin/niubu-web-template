import { useTranslation } from '@niubu/locales/react';
import { useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ReadContext } from '@niubu/core-typings';
import { useAppStoreSnapshot } from '@niubu/stores/react';

export interface RoutingQueryOwner {
  subscribe(listener: () => void): () => void;
  getSnapshot(): unknown;
  acquire(identityKey: string, context: ReadContext): () => void;
  matches(identityKey: string, context: ReadContext): boolean;
}
/** The caller supplies the query owner; semantic context changes retire one lease. */
export function QueryRouteBoundary({
  context,
  owner,
  children,
}: {
  context: ReadContext;
  owner: RoutingQueryOwner;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { session } = useAppStoreSnapshot();
  const { kind, id } = context.scope;
  const { businessDate, timeZone } = context;
  const stableContext = useMemo(
    () => ({ scope: { kind, id }, businessDate, timeZone }),
    [kind, id, businessDate, timeZone],
  );
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => {
    if (session.disposed) return;
    return owner.acquire(session.identityKey, stableContext);
  }, [owner, session.identityKey, session.disposed, stableContext]);
  if (session.disposed || !owner.matches(session.identityKey, context))
    return <div role="status">{t('read.loading.title')}</div>;
  return children;
}
