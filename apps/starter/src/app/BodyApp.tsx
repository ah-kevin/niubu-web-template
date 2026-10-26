import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { flattenNavigation } from '@niubu/access';
import { BusinessShell } from '@niubu/layouts';
import { NavigationGuard, PageTabsBinding, PageTabsView } from '@niubu/layouts/routing';
import { useStarterRouting } from './page-routing';
import { FoundationTools, Copyright, Breadcrumbs, WorkspaceContext } from '@niubu/layouts/widgets';
import { ManagedPreferenceDrawer } from '@niubu/common-ui/preferences';
import { useAppStoreSnapshot, useAppStores } from '@niubu/stores/react';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useSyncExternalStore, type ReactNode } from 'react';
import type { LinkProps } from '@niubu/menu-ui';
import { useStarterApi } from './api-context';
import { RequestFailure } from '../modules/status';
import { appConfig } from './config';
import { useAuthSnapshot, useStarterAuth } from '../auth/context';
import { resolveStarterAccess } from '../auth/access';
import { projectMenu } from '../auth/navigation';
import { ScopeSync } from '../auth/ScopeSync';
import { ExpiredLogin } from '../auth/Expired';
import { withScope } from '../auth/scope';
import { ShellActions } from './ShellActions';
import { useStarterLockSnapshot, useStarterShell } from './shell-context';
import { ShellBoundary } from './ShellBoundary';
import { OverlayProvider } from '@niubu/common-ui/overlay';
import { StarterBrand } from './Brand';
import { buildStarterBreadcrumbs } from './breadcrumbs';
import { registry } from '../modules/demo';
import { icons } from '../icons';

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
    auth = useStarterAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const api = useStarterApi();
  const stores = useAppStores();
  const tabState = useSyncExternalStore(stores.tabs.subscribe, stores.tabs.getSnapshot, stores.tabs.getSnapshot);
  const pageRuntime = useStarterRouting();
  const shell = useStarterShell(),
    lock = useStarterLockSnapshot();
  const publicMenu = useQuery({
    queryKey: ['starter', 'public-menu'],
    queryFn: ({ signal }) => api.menu(signal),
    enabled: state.user === null && state.status === 'anonymous',
  });
  const access = resolveStarterAccess(state, publicMenu.data?.ok ? publicMenu.data.data : []),
    navigation = projectMenu(access.menu, location.pathname, state.scope, key => t(key));
  const crumbs = buildStarterBreadcrumbs(
    access.menu,
    pageRuntime.describe(location).meta,
    location.pathname,
    registry.routes,
  );
  const homeHref = `/home${withScope('', state.scope)}`;
  const workspacePicker = (appearance: 'sidebar' | 'header', compact = false) =>
    state.user ? (
      <WorkspaceContext
        label={t('workspace')}
        groupLabel={t('workspace')}
        rangeLabel={t('workspace')}
        placeholder={t('system.choose')}
        emptyLabel={t('common:read.empty.title')}
        groupValue="workspaces"
        value={state.scope?.kind === 'workspace' ? state.scope.id : ''}
        groups={[
          {
            value: 'workspaces',
            label: t('workspace'),
            options: state.user.workspaces.map(scope => ({ value: scope.id, label: scope.name ?? scope.id })),
          },
        ]}
        appearance={appearance}
        compact={compact}
        disabled={state.status !== 'ready' || state.loginExpired}
        onValueChange={id => {
          if (!state.user?.workspaces.some(scope => scope.id === id)) return;
          const scope = { kind: 'workspace', id };
          void navigate({
            pathname: location.pathname,
            search: withScope(location.search, scope),
            hash: location.hash,
          });
        }}
      />
    ) : undefined;

  const content = (
    <>
      <NavigationGuard description={t('common:guard.livePreserveDescription')} />
      <ScopeSync />
      <div className="template-workspace contents [&_.workspace-frame]:bg-background [&_.workspace-main]:bg-background [&_.layout-logo]:min-h-[var(--layout-header-height)] [&_.layout-logo]:px-[16px] [&_.starter-brand-name]:text-[14px] [&_.breadcrumbs]:gap-[6px] [&_.breadcrumbs]:whitespace-nowrap [&_.breadcrumbs]:text-[13px] [&_.context-actions]:gap-[12px]">
        <BusinessShell
          brand={appConfig.displayName}
          logo={<StarterBrand href={homeHref} />}
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
          navigationKey={`starter:${state.user?.id ?? 'anonymous'}:${state.scope?.id ?? ''}:${location.pathname}:${state.status}:${state.generation}`}
          navigation={navigation}
          renderLink={props => <AppLink {...props} />}
          onNavigateTo={href => void navigate(href)}
          sidebarContext={({ compact }) => workspacePicker('sidebar', compact)}
          scopeSelector={workspacePicker('header')}
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
              sessionKey={`starter:${state.user?.id ?? 'anonymous'}`}
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
