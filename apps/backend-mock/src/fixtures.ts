import type { BackendMenuItem } from '@niubu/types';
import type { MockConfig, MockUser } from './config';
import { createWorkspaceSeed, navigablePageIds } from './system/fixtures';

// Intentionally public, synthetic examples. Never use real credentials here.
export const MOCK_ONLY_SENTINEL = 'NIUBU_BACKEND_MOCK_ONLY_STAGE3';

export type User = MockUser;

export const demoAccount = { username: 'demo@playground.invalid', password: 'demo-only' } as const;
export const secondAccount = { username: 'second@playground.invalid', password: 'demo-only' } as const;
export const demoUser = {
  id: 'demo-user',
  name: 'Demo User',
  roles: ['admin'],
  workspaces: [
    { kind: 'workspace', id: 'north', name: 'North' },
    { kind: 'workspace', id: 'south', name: 'South' },
  ],
} as const satisfies User;

export const secondUser = {
  id: 'second-user',
  name: 'Second User',
  roles: ['viewer'],
  workspaces: [
    { kind: 'workspace', id: 'north', name: 'North' },
    { kind: 'workspace', id: 'south', name: 'South' },
  ],
} as const satisfies User;

const home = { kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' } as const;
const profile = { kind: 'page', id: 'profile', pageId: 'playground.profile', hidden: true } as const;
export const publicMenu = [home] as const satisfies readonly BackendMenuItem[];
export const systemMenu = {
  kind: 'group',
  id: 'system',
  title: 'app:navigation.system',
  icon: 'settings',
  order: 40,
  children: ['users', 'roles', 'menus', 'departments'].map(resource => ({
    kind: 'page' as const,
    id: `system-${resource}`,
    pageId: `playground.system.${resource}`,
  })),
} as const satisfies BackendMenuItem;
export const systemReadCodes = [
  'system:users:read',
  'system:roles:read',
  'system:menus:read',
  'system:departments:read',
] as const;
export const systemWriteCodes = [
  'system:users:write',
  'system:roles:write',
  'system:menus:write',
  'system:departments:write',
] as const;
const overviewMenu = {
  kind: 'group',
  id: 'workspace-pages',
  title: 'app:navigation.overview',
  icon: 'home',
  order: 10,
  children: [home],
} as const satisfies BackendMenuItem;
export const examplesMenu = {
  kind: 'group',
  id: 'playground-examples',
  title: 'app:navigation.components',
  icon: 'boxes',
  order: 20,
  children: [
    { kind: 'page', id: 'example-forms', pageId: 'playground.examples.forms' },
    { kind: 'page', id: 'example-tables', pageId: 'playground.examples.tables' },
    { kind: 'page', id: 'example-components', pageId: 'playground.examples.components' },
    { kind: 'page', id: 'example-feedback', pageId: 'playground.examples.feedback' },
    {
      kind: 'group',
      id: 'design-table-scenarios',
      title: 'app:designSystem.group',
      icon: 'database',
      children: [
        { kind: 'page', id: 'design-choose', pageId: 'playground.design.choose' },
        { kind: 'page', id: 'design-read', pageId: 'playground.design.read' },
        { kind: 'page', id: 'design-actions', pageId: 'playground.design.actions' },
        { kind: 'page', id: 'design-selection', pageId: 'playground.design.selection' },
        { kind: 'page', id: 'design-single', pageId: 'playground.design.single' },
        { kind: 'page', id: 'design-layout', pageId: 'playground.design.layout' },
        { kind: 'page', id: 'design-header', pageId: 'playground.design.header' },
        { kind: 'page', id: 'design-expand', pageId: 'playground.design.expand' },
        { kind: 'page', id: 'design-edit', pageId: 'playground.design.edit' },
        { kind: 'page', id: 'design-merge', pageId: 'playground.design.merge' },
        { kind: 'page', id: 'design-drag', pageId: 'playground.design.drag' },
        { kind: 'page', id: 'design-states', pageId: 'playground.design.states' },
        { kind: 'page', id: 'design-tree', pageId: 'playground.design.tree' },
      ],
    },
    { kind: 'page', id: 'example-complete-list', pageId: 'playground.examples.complete-list' },
  ],
} as const satisfies BackendMenuItem;
const northNetworkMenu = [
  { kind: 'page', id: 'request', pageId: 'playground.request', icon: 'arrow-right-left', badge: 'Demo' },
  {
    kind: 'external',
    id: 'documentation',
    title: 'app:navigation.documentation',
    href: 'https://example.com/docs',
    icon: 'external-link',
    order: 20,
    openInNewWindow: true,
  },
  {
    kind: 'iframe',
    id: 'frame-demo',
    title: 'app:navigation.embedded',
    src: '/frame-demo.html',
    icon: 'monitor',
    order: 30,
  },
  // Deliberately unknown: consumers must diagnose and skip this item only.
  { kind: 'page', id: 'unknown-demo', pageId: 'unknown.page', title: 'app:navigation.unknown', order: 40 },
] as const satisfies readonly BackendMenuItem[];
function featureMenu(networkEntries: readonly BackendMenuItem[] = []): BackendMenuItem {
  return {
    kind: 'group',
    id: 'playground-features',
    title: 'app:navigation.features',
    icon: 'wrench',
    order: 30,
    children: [
      {
        kind: 'group',
        id: 'feature-application',
        title: 'app:navigation.application',
        icon: 'layout-grid',
        children: [
          { kind: 'page', id: 'example-access', pageId: 'playground.examples.access' },
          { kind: 'page', id: 'example-navigation', pageId: 'playground.examples.navigation' },
          { kind: 'page', id: 'example-tabs', pageId: 'playground.examples.tabs' },
          { kind: 'page', id: 'example-tab-detail', pageId: 'playground.examples.tab-detail', hidden: true },
          {
            kind: 'page',
            id: 'example-navigation-second',
            pageId: 'playground.examples.navigation-second',
            hidden: true,
          },
          {
            kind: 'page',
            id: 'example-navigation-third',
            pageId: 'playground.examples.navigation-third',
            hidden: true,
          },
          { kind: 'page', id: 'example-navigation-deep', pageId: 'playground.examples.navigation-deep', hidden: true },
          {
            kind: 'page',
            id: 'example-navigation-detail',
            pageId: 'playground.examples.navigation-detail',
            hidden: true,
          },
        ],
      },
      {
        kind: 'group',
        id: 'feature-browser',
        title: 'app:navigation.browser',
        icon: 'monitor',
        children: [
          { kind: 'page', id: 'example-browser', pageId: 'playground.examples.browser' },
          { kind: 'page', id: 'example-preferences', pageId: 'playground.examples.preferences' },
        ],
      },
      {
        kind: 'group',
        id: 'feature-network',
        title: 'app:navigation.network',
        icon: 'globe',
        children: [
          ...networkEntries.filter(item => item.kind === 'page' && item.id === 'request'),
          { kind: 'page', id: 'example-requests', pageId: 'playground.examples.requests' },
          { kind: 'page', id: 'example-query', pageId: 'playground.examples.query' },
          ...networkEntries.filter(item => item.id !== 'request'),
        ],
      },
    ],
  };
}
const featuresMenu = featureMenu();
export const scopedFixtures = {
  north: {
    menu: [overviewMenu, examplesMenu, featureMenu(northNetworkMenu), systemMenu, profile],
    codes: ['demo:read', 'demo:echo', 'demo:transfer', ...systemReadCodes, ...systemWriteCodes],
  },
  south: { menu: [overviewMenu, examplesMenu, featuresMenu, profile], codes: ['demo:read'] },
} as const satisfies Record<string, { menu: readonly BackendMenuItem[]; codes: readonly string[] }>;

const secondScopedFixtures = {
  north: {
    menu: [overviewMenu, examplesMenu, featuresMenu, systemMenu, profile],
    codes: ['demo:read', ...systemReadCodes],
  },
  south: { menu: [overviewMenu, examplesMenu, featuresMenu, profile], codes: ['demo:read'] },
} as const satisfies Record<string, { menu: readonly BackendMenuItem[]; codes: readonly string[] }>;

export const syntheticAccounts = [
  { ...demoAccount, user: demoUser, scopes: scopedFixtures },
  { ...secondAccount, user: secondUser, scopes: secondScopedFixtures },
] as const;

/** The Playground defaults are data; service machinery accepts a complete replacement. */
export const defaultMockConfig = {
  accounts: syntheticAccounts,
  publicMenu,
  navigablePageIds,
  systemSeeds: { north: createWorkspaceSeed('north'), south: createWorkspaceSeed('south') },
} satisfies MockConfig;
