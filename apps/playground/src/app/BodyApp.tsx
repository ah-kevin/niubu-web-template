import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { flattenNavigation } from '@niubu/access';
import { BusinessShell } from '@niubu/layouts';
import { NavigationGuard, PageTabsBinding, PageTabsView } from '@niubu/layouts/routing';
import { usePlaygroundRouting } from './page-routing';
import { FoundationTools, Copyright, Breadcrumbs } from '@niubu/layouts/widgets';
import { ManagedPreferenceDrawer } from '@niubu/common-ui/preferences';
import { useAppStoreSnapshot, useAppStores } from '@niubu/stores/react';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useSyncExternalStore, type ReactNode } from 'react';
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
import { PlaygroundBrand } from './Brand';
import { buildPlaygroundBreadcrumbs } from './breadcrumbs';
import { registry } from '../modules/demo';
import { icons } from '../icons';
import { Select } from '@niubu/shadcn-ui/select';

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
  const stores = useAppStores();
  const tabState = useSyncExternalStore(stores.tabs.subscribe, stores.tabs.getSnapshot, stores.tabs.getSnapshot);
  const pageRuntime = usePlaygroundRouting();
  const shell = usePlaygroundShell(),
    lock = usePlaygroundLockSnapshot();
  const publicMenu = useQuery({
    queryKey: ['playground', 'public-menu'],
    queryFn: ({ signal }) => api.menu(signal),
    enabled: state.user === null && state.status === 'anonymous',
  });
  const access = resolvePlaygroundAccess(state, publicMenu.data?.ok ? publicMenu.data.data : []),
    navigation = projectMenu(access.menu, location.pathname, state.scope, key => t(key));
  const crumbs = buildPlaygroundBreadcrumbs(
    access.menu,
    pageRuntime.describe(location).meta,
    location.pathname,
    registry.routes,
  );
  const homeHref = `/home${withScope('', state.scope)}`;
  const content = (
    <>
      <NavigationGuard description={t('common:guard.livePreserveDescription')} />
      <ScopeSync />
      <div className="template-workspace contents [&_.workspace-main]:bg-background [&_.layout-logo]:min-h-[var(--layout-header-height)] [&_.layout-logo]:px-[16px] [&_.playground-brand-name]:text-[14px] [&_.breadcrumbs]:gap-[6px] [&_.breadcrumbs]:whitespace-nowrap [&_.breadcrumbs]:text-[13px] [&_.context-actions]:gap-[12px]">
        <BusinessShell
          brand={appConfig.displayName}
          logo={<PlaygroundBrand href={homeHref} />}
          tabs={core.tabbar.enabled ? <PageTabsView /> : undefined}
          contentMaximized={tabState.contentMaximized}
          onRestoreContent={() => stores.tabs.setMaximized(false)}
          breadcrumbs={
            <Breadcrumbs
              items={crumbs}
              value={core.breadcrumb}
              renderIcon={token => {
                const Icon = icons.resolve(token ?? 'home');
                return Icon ? <Icon width={14} height={14} aria-hidden="true" /> : null;
              }}
              renderLink={(item, children) => <Link to={item.href!}>{children}</Link>}
            />
          }
          navigationKey={`playground:${state.user?.id ?? 'anonymous'}:${state.scope?.id ?? ''}:${location.pathname}:${state.status}:${state.generation}`}
          navigation={navigation}
          renderLink={props => <AppLink {...props} />}
          onNavigateTo={href => void navigate(href)}
          scopeSelector={
            state.user ? (
              <label className="template-scope-selector inline-flex items-center gap-2 whitespace-nowrap text-[12px] text-muted-foreground">
                {t('workspace')}
                <Select
                  label={t('workspace')}
                  className="min-w-0 max-w-40"
                  value={state.scope?.kind === 'workspace' ? state.scope.id : ''}
                  onValueChange={id => {
                    const scope = { kind: 'workspace', id };
                    void navigate({
                      pathname: location.pathname,
                      search: withScope(location.search, scope),
                      hash: location.hash,
                    });
                  }}
                  options={state.user.workspaces.map(scope => ({ value: scope.id, label: scope.name ?? scope.id }))}
                />
              </label>
            ) : undefined
          }
          userMenu={
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
              quickAppearance
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
              renderPreferences={props => (
                <ManagedPreferenceDrawer {...props} extensions={[]} configuration={() => []} />
              )}
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
      </div>
      {!shell && <ExpiredLogin />}
    </>
  );
  const body =
    location.pathname === '/login' ? (
      <>
        <NavigationGuard description={t('common:guard.livePreserveDescription')} />
        {children}
      </>
    ) : (
      content
    );
  return (
    <ShellBoundary runtime={shell}>
      <PageTabsBinding runtime={pageRuntime}>
        {shell ? <OverlayProvider>{body}</OverlayProvider> : body}
      </PageTabsBinding>
    </ShellBoundary>
  );
}
