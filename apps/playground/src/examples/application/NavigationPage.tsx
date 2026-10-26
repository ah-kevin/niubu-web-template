import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
import { Link } from 'react-router-dom';
import { useAuthSnapshot } from '../../auth/context';
import { useOptionalPageTabs, usePageTabs } from '@niubu/layouts/routing';
import { withScope } from '../../auth/scope';
import { useApplicationText } from './copy';
import { useState } from 'react';
import { resolveAccess, projectBreadcrumbs, type NavigationRoute } from '@niubu/access';
import { TreeNavigation } from '@niubu/menu-ui';
import { Breadcrumbs, WorkspaceContext } from '@niubu/layouts/widgets';
import { corePreferenceDefaults } from '@niubu/core-preferences';
import { Button } from '@niubu/shadcn-ui/button';
import type { ScopeRef, BackendMenuItem } from '@niubu/types';
import { projectMenu } from '../../auth/navigation';
const names = ['Menu 1', 'Menu 2-1', 'Menu 3-1', 'Menu 3-2-1', '隐藏详情'];
const paths = [
  '/examples/navigation',
  '/examples/navigation/second',
  '/examples/navigation/third',
  '/examples/navigation/third/deep',
  '/examples/navigation/detail',
];
const routes = names.map((_, i) => ({
  id: `nav.${i}`,
  path: paths[i]!,
  titleKey: `app:examples.navigationLabels.${i}`,
  iconToken: 'home',
  order: i,
  navigation: true,
  scope: 'workspace',
  capability: null,
  domain: 'demo',
  groupKey: 'demo',
  hideInMenu: i === 4,
  openInNewWindow: i === 1,
  badge: i === 0 ? 'New' : i === 2 ? 3 : undefined,
})) satisfies NavigationRoute[];
const page = (i: number): BackendMenuItem => ({ kind: 'page', id: `nav.${i}`, pageId: `nav.${i}`, title: names[i] });
const menu: readonly BackendMenuItem[] = [
  page(0),
  page(1),
  {
    kind: 'group',
    id: 'level2',
    title: 'Level 2',
    children: [page(2), { kind: 'group', id: 'level3', title: 'Level 3', children: [page(3)] }],
  },
  page(4),
  { kind: 'external', id: 'vite', title: 'Vite', href: 'https://vite.dev', openInNewWindow: true },
  { kind: 'external', id: 'vueuse', title: 'VueUse', href: 'https://vueuse.org', openInNewWindow: true },
  { kind: 'iframe', id: 'local', title: '本地嵌入示例', src: '/frame-demo.html' },
];
export function NavigationPage({
  initialPath = paths[0]!,
  liveScope,
}: { initialPath?: string; liveScope?: ScopeRef | null } = {}) {
  const text = useApplicationText();
  const controller = useOptionalPageTabs();
  const [path, setPath] = useState(initialPath);
  const [organization, setOrganization] = useState('north'),
    [range, setRange] = useState('all');
  const [expanded, setExpanded] = useState<readonly string[]>(['level2', 'level3']);
  const [embedded, setEmbedded] = useState(true);
  const scope = { kind: 'workspace', id: 'north' };
  const access = resolveAccess({
    mode: 'backend',
    routes,
    backendMenu: embedded ? menu : menu.filter(n => n.id !== 'local'),
    access: { scopes: [scope], capabilities: [] },
    roles: [],
    codes: [],
    scope,
    authenticated: true,
    baseURL: window.location.origin,
  });
  const selectedFrame = embedded && path === '/embedded/local';
  const current = routes.find(r => r.path === path) ?? routes[0]!;
  const pageItems = projectBreadcrumbs(
    current,
    scope,
    routes.filter(r => !r.hideInMenu),
    { homePath: paths[0]!, domainLabels: { demo: 'app:examples.navigation' } },
  );
  const items = selectedFrame
    ? [
        ...pageItems.map(item => ({ ...item, current: false, href: paths[0] })),
        { id: 'local', labelKey: 'app:examples.application.frame', current: true },
      ]
    : pageItems;
  return (
    <ExamplePage title={text('navigationTitle')} description={text('navigationIntro')}>
      <ExampleSection title={text('contextTitle')} description={text('contextIntro')}>
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <div className="w-56 max-w-full">
            <WorkspaceContext
              label={text('contextTitle')}
              groupLabel={text('contextOrganization')}
              rangeLabel={text('contextRange')}
              groupValue={organization}
              value={range}
              groups={['north', 'south'].map(value => ({
                value,
                label: text(value === 'north' ? 'contextNorth' : 'contextSouth'),
                options:
                  value === organization
                    ? [
                        { value: 'all', label: text('contextAll') },
                        { value: value + '-team', label: text('contextTeam') },
                      ]
                    : undefined,
              }))}
              onGroupChange={value => {
                setOrganization(value);
                setRange('all');
              }}
              onValueChange={setRange}
              groupActionLabel={text('contextSwitch')}
              groupActionDescription={text('contextSwitchHint')}
              emptyLabel={text('contextEmpty')}
            />
          </div>
          <div className="w-56 max-w-full">
            <WorkspaceContext
              label={text('contextFixed')}
              groupLabel={text('contextOrganization')}
              rangeLabel={text('contextRange')}
              groupValue="fixed"
              value="all"
              groups={[
                { value: 'fixed', label: text('contextFixed'), options: [{ value: 'all', label: text('contextAll') }] },
              ]}
            />
          </div>
        </div>
      </ExampleSection>
      <div className="grid min-w-0 items-start gap-[var(--workspace-section-gap)] lg:grid-cols-[minmax(14rem,1fr)_minmax(0,3fr)]">
        <ExampleSection title={text('menu')} bodyClassName="p-2">
          <TreeNavigation
            nodes={projectMenu(access.menu, path, scope, key => key)}
            label={text('menu')}
            expandedIds={expanded}
            onExpand={(id, open) => setExpanded(v => (open ? [...v, id] : v.filter(x => x !== id)))}
            renderLink={({ external, ...props }) => (
              <a
                {...props}
                href={
                  !external && props.target === '_blank' && liveScope !== undefined
                    ? (() => {
                        const url = new URL(props.href, window.location.origin);
                        return url.pathname + withScope(url.search, liveScope) + url.hash;
                      })()
                    : props.href
                }
                onClick={e => {
                  if (!external && props.target !== '_blank') {
                    e.preventDefault();
                    setPath(new URL(props.href, window.location.origin).pathname);
                  }
                }}
              />
            )}
          />
        </ExampleSection>
        <div className="grid min-w-0 gap-[var(--workspace-section-gap)]">
          <ExampleSection title={text('navigationPreview')}>
            <Breadcrumbs
              items={items}
              value={{ ...corePreferenceDefaults.breadcrumb, showHome: true }}
              renderIcon={() => null}
              renderLink={(item, children) => (
                <a
                  href={item.href}
                  onClick={e => {
                    e.preventDefault();
                    setPath(new URL(item.href!, window.location.origin).pathname);
                  }}
                >
                  {children}
                </a>
              )}
            />
            <p role="status" className="rounded-md bg-muted/40 px-3 py-3 text-sm">
              {selectedFrame ? text('frame') : current.id === 'nav.4' ? text('direct') : names[routes.indexOf(current)]}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => setPath(paths[4]!)}>
                {text('openHidden')}
              </Button>
              {controller && (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={`/examples/navigation/detail${withScope('', liveScope === undefined ? scope : liveScope)}`}
                    >
                      {text('routedDetail')}
                    </Link>
                  </Button>
                  <NavigationCloseButton />
                </>
              )}
              {current.id === 'nav.4' && (
                <Button size="sm" variant="outline" onClick={() => setPath(paths[0]!)}>
                  {text('back')}
                </Button>
              )}
            </div>
          </ExampleSection>
          <ExampleSection title={text('frame')} description={text('frameIntro')}>
            {embedded && (
              <iframe
                title={text('frame')}
                src="/frame-demo.html"
                sandbox="allow-scripts allow-forms"
                referrerPolicy="no-referrer"
                className="playground-frame min-h-64 w-full rounded-md border border-border bg-muted/20"
              />
            )}
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => {
                if (selectedFrame) setPath(paths[0]!);
                setEmbedded(v => !v);
              }}
            >
              {embedded ? text('revokeFrame') : text('restoreFrame')}
            </Button>
          </ExampleSection>
        </div>
      </div>
      <ExampleDetails title={text('implementation')}>
        <p>{text('navigationHelp')}</p>
        <p>{text('frameHelp')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}

function RegisteredNavigation({ initialPath }: { initialPath?: string } = {}) {
  const { scope } = useAuthSnapshot();
  return <NavigationPage initialPath={initialPath} liveScope={scope} />;
}
export function NavigationRoutePage() {
  return <RegisteredNavigation />;
}
export function NavigationSecondPage() {
  return <RegisteredNavigation initialPath="/examples/navigation/second" />;
}
export function NavigationThirdPage() {
  return <RegisteredNavigation initialPath="/examples/navigation/third" />;
}
export function NavigationDeepPage() {
  return <RegisteredNavigation initialPath="/examples/navigation/third/deep" />;
}
export function NavigationDetailPage() {
  return <RegisteredNavigation initialPath="/examples/navigation/detail" />;
}

function NavigationCloseButton() {
  const tabs = usePageTabs();
  const text = useApplicationText();
  const key = tabs.snapshot.activeKey;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!key || key === tabs.snapshot.homeKey}
      onClick={() => key && tabs.request({ type: 'close', key })}
    >
      {text('close')}
    </Button>
  );
}
