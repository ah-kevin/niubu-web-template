import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { flattenNavigation } from '@niubu/access';
import { BusinessShell } from '@niubu/layouts';
import { NavigationGuard } from '@niubu/layouts/routing';
import { FoundationTools, Copyright } from '@niubu/layouts/widgets';
import { ManagedPreferenceDrawer } from '@niubu/common-ui/preferences';
import { useAppStoreSnapshot } from '@niubu/stores/react';
import { usePreferenceSnapshot } from '@niubu/preferences';
import type { ReactNode } from 'react';
import type { LinkProps } from '@niubu/menu-ui';
import { usePlaygroundApi } from './api-context';
import { RequestFailure } from '../modules/status';
import { appConfig } from './config';
import { useAuthSnapshot, usePlaygroundAuth } from '../auth/context';
import { resolvePlaygroundAccess } from '../auth/access';
import { projectMenu } from '../auth/navigation';
import { ScopeSync } from '../auth/ScopeSync';
import { ExpiredLogin } from '../auth/Expired';
import { withScope } from '../auth/scope';
import { ShellActions } from './ShellActions';
import { usePlaygroundLockSnapshot, usePlaygroundShell } from './shell-context';
import { ShellBoundary } from './ShellBoundary';
import { OverlayProvider } from '@niubu/common-ui/overlay';

function AppLink({ href, external, target, rel, ...props }: LinkProps) {
  return external || target === '_blank' ? (
    <a href={href} target={target} rel={rel} {...props} />
  ) : (
    <Link to={href} {...props} />
  );
}
export function BodyApp({ children }: { children: ReactNode }) {
  const { t, locale } = useTranslation('app'),
    { core } = usePreferenceSnapshot(),
    { ui } = useAppStoreSnapshot();
  const state = useAuthSnapshot(),
    auth = usePlaygroundAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const api = usePlaygroundApi();
  const shell = usePlaygroundShell(),
    lock = usePlaygroundLockSnapshot();
  const publicMenu = useQuery({
    queryKey: ['playground', 'public-menu'],
    queryFn: ({ signal }) => api.menu(signal),
    enabled: state.user === null && state.status === 'anonymous',
  });
  const access = resolvePlaygroundAccess(state, publicMenu.data?.ok ? publicMenu.data.data : []),
    navigation = projectMenu(access.menu, location.pathname, state.scope, key => t(key));
  const content = (
    <>
      <NavigationGuard description={t('common:guard.livePreserveDescription')} />
      <ScopeSync />
      <BusinessShell
        brand={appConfig.displayName}
        navigationKey={`playground:${state.user?.id ?? 'anonymous'}:${state.scope?.id ?? ''}`}
        navigation={navigation}
        renderLink={props => <AppLink {...props} />}
        onNavigateTo={href => void navigate(href)}
        scopeSelector={
          state.user ? (
            <label>
              {t('workspace')}
              <select
                aria-label={t('workspace')}
                value={state.scope?.kind === 'workspace' ? state.scope.id : ''}
                onChange={event => {
                  const scope = { kind: 'workspace', id: event.target.value };
                  void navigate({
                    pathname: location.pathname,
                    search: withScope(location.search, scope),
                    hash: location.hash,
                  });
                }}
              >
                {state.user.workspaces.map(scope => (
                  <option key={`${scope.kind}:${scope.id}`} value={scope.id}>
                    {scope.name ?? scope.id}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        topActions={
          state.user ? (
            <>
              <ShellActions />
            </>
          ) : (
            <Link to="/login">{t('login')}</Link>
          )
        }
        mobileAccount={state.user ? <ShellActions showUpdates={false} /> : <Link to="/login">{t('login')}</Link>}
        foundationTools={({ headerAvailable, headerTarget }) => (
          <FoundationTools
            sessionKey={`playground:${state.user?.id ?? 'anonymous'}`}
            headerAvailable={headerAvailable}
            headerTarget={headerTarget}
            onRefresh={() => {
              if (state.user) void auth.switchScope(state.scope).catch(() => {});
              else void publicMenu.refetch();
            }}
            shortcutsEnabled={!lock.locked && !state.loginExpired}
            search={{
              locale,
              pages: flattenNavigation(navigation)
                .filter(node => node.href.startsWith('/'))
                .map(node => ({ id: node.id, title: node.label, href: node.href })),
              renderLink: ({ href, ...props }) => <Link to={href} {...props} />,
            }}
            notifications={{ items: [], renderLink: ({ href, ...props }) => <Link to={href} {...props} /> }}
            renderPreferences={props => <ManagedPreferenceDrawer {...props} extensions={[]} configuration={() => []} />}
          />
        )}
        footer={core.footer.enabled ? <Copyright value={core.copyright} /> : undefined}
      >
        {ui.localeError && <p role="alert">{t('localeError')}</p>}
        {!state.user && publicMenu.data && !publicMenu.data.ok && (
          <RequestFailure name="menu" error={publicMenu.data.error} />
        )}
        {!state.user && publicMenu.isError && <p role="alert">menu: transport</p>}
        {children}
      </BusinessShell>
      {!shell && <ExpiredLogin />}
    </>
  );
  return (
    <ShellBoundary runtime={shell}>{shell ? <OverlayProvider>{content}</OverlayProvider> : content}</ShellBoundary>
  );
}
