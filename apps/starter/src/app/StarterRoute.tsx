import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import type { ReadContext } from '@niubu/types';
import type { PageLocation, PageTypeReport } from '@niubu/stores';
import { RouteFrame, type FrameResolution } from '@niubu/layouts/routing';
import { useTranslation } from '@niubu/locales/react';
import { registry } from '../modules/demo';
import { Guard } from '../auth/Guard';
import { appConfig } from './config';
import { useStarterRouting } from './page-routing';
import { useLocation } from 'react-router-dom';
import { useAuthSnapshot } from '../auth/context';
import type { PageRoutingRuntime } from '@niubu/layouts/routing';
export function StarterRoute({ path, registered: Registered }: { path: string; registered?: ComponentType }) {
  const { t } = useTranslation('app');
  const currentRuntime = useStarterRouting();
  const auth = useAuthSnapshot();
  const location = useLocation();
  const identity = auth.user?.id ?? '';
  const href = location.pathname + location.search + location.hash;
  const [admitted, setAdmitted] = useState<{ identity: string; href: string; runtime: PageRoutingRuntime } | null>(
    null,
  );
  // Preserve only the exact already-admitted identity/location during same-person reauthentication.
  // The shell controller continues to validate all new navigation against current, revoked grants.
  if (
    auth.status === 'ready' &&
    !auth.loginExpired &&
    currentRuntime.describe(location).status === 'ready' &&
    (admitted?.identity !== identity || admitted.href !== href || admitted.runtime !== currentRuntime)
  )
    setAdmitted({ identity, href, runtime: currentRuntime });
  const runtime =
    auth.loginExpired && admitted?.identity === identity && admitted.href === href ? admitted.runtime : currentRuntime;
  const describeLocation = runtime.describe;
  const route = registry.routes.find(r => r.path === path);
  const resolveFrame = useCallback(
    (): FrameResolution => ({
      title: route ? t(route.titleKey) : t('notFound'),
      kind: route?.scope === 'public' ? 'public' : 'protected',
      scope: null,
      context: null,
    }),
    [route, t],
  );
  const describe = useCallback(
    (location: PageLocation, _context: ReadContext | null, report?: PageTypeReport) =>
      describeLocation(location, report),
    [describeLocation],
  );
  const renderShell = useCallback(
    (_kind: FrameResolution['kind'], children: ReactNode) =>
      route ? <Guard meta={route}>{children}</Guard> : children,
    [route],
  );
  return (
    <RouteFrame
      path={path}
      registered={Registered}
      appTitle={appConfig.displayName}
      resolveFrame={resolveFrame}
      describe={describe}
      resolveTab={runtime.resolveTab}
      requiresReport={() => false}
      renderShell={renderShell}
      renderFallback={() => (
        <section className="starter-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
          <h1>{t('notFound')}</h1>
        </section>
      )}
    />
  );
}
