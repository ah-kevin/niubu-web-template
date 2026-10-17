import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import type { RouteMeta } from '@niubu/types';
import { useAuthSnapshot, usePlaygroundAuth } from './context';
import { equalScope, readPlaygroundScope } from './scope';
import { resolvePlaygroundAccess } from './access';
import { resolvePlaygroundReturnTo } from './return-to';
import { Button } from '@niubu/shadcn-ui/button';

export function Guard({ meta, children }: { meta: RouteMeta; children: ReactNode }) {
  const state = useAuthSnapshot(),
    auth = usePlaygroundAuth(),
    location = useLocation(),
    { t } = useTranslation('app');
  const access = resolvePlaygroundAccess(state),
    selected = readPlaygroundScope(location.search, state.user);
  const embedded =
    meta.id === 'playground.embedded'
      ? access.iframeItems.some(item => `/embedded/${encodeURIComponent(item.id)}` === location.pathname)
      : false;
  const granted = embedded || access.grantedPageIds.includes(meta.id);
  const ready = state.status === 'ready' && selected.valid && equalScope(selected.scope, state.scope) && granted;
  const key = `${state.user?.id ?? ''}:${location.pathname}${location.search}${location.hash}`;
  const [admitted, setAdmitted] = useState<string | null>(null);
  // This conditional state adjustment remembers admission, never grants a different location or identity.
  if (ready && admitted !== key) setAdmitted(key);
  if (meta.scope === 'public' || meta.ignoreAccess) return <>{children}</>;
  if (state.loginExpired && admitted === key) return <>{children}</>;
  if (state.status === 'restoring') return <p role="status">{t('pending')}</p>;
  if (!state.user)
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(resolvePlaygroundReturnTo(`${location.pathname}${location.search}${location.hash}`))}`}
      />
    );
  if (!selected.valid)
    return (
      <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
        <h1>{t('forbidden')}</h1>
      </section>
    );
  if (!equalScope(selected.scope, state.scope) || state.status === 'loading')
    return <p role="status">{t('pending')}</p>;
  if (state.status === 'error')
    return (
      <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
        <p role="alert">{t('accessError')}</p>
        <Button onClick={() => void auth.switchScope(selected.scope).catch(() => {})}>{t('retry')}</Button>
      </section>
    );
  if (!granted)
    return (
      <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
        <h1>{t('forbidden')}</h1>
      </section>
    );
  return <>{children}</>;
}
