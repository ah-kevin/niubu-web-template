import { systemResources } from './contracts';
import type { ResourceRecords, SystemResource, WorkspaceId } from './contracts';

export type WorkspaceSeed = { [R in SystemResource]: ResourceRecords[R][] };
/** Fresh data on each invocation; these records never define login identities or grants. */
export function createWorkspaceSeed(workspace: WorkspaceId): WorkspaceSeed {
  const roleId = `role-${workspace}-operator`;
  const auditId = `role-${workspace}-auditor`;
  const rootId = `department-${workspace}-root`;
  const childId = `department-${workspace}-child`;
  const groupId = `menu-${workspace}-group`;
  return {
    roles: [
      { id: roleId, name: 'Operator', code: 'operator', description: 'Synthetic operator', enabled: true },
      { id: auditId, name: 'Auditor', code: 'auditor', description: 'Synthetic auditor', enabled: true },
    ],
    departments: [
      { id: rootId, name: 'Head office', code: 'head-office', parentId: null, enabled: true },
      { id: childId, name: 'Operations', code: 'operations', parentId: rootId, enabled: true },
    ],
    menus: [
      { id: groupId, title: 'Examples', kind: 'group', parentId: null, order: 0, enabled: true },
      {
        id: `menu-${workspace}-home`,
        title: 'Home',
        kind: 'page',
        pageId: 'playground.home',
        parentId: groupId,
        order: 1,
        enabled: true,
      },
      {
        id: `menu-${workspace}-docs`,
        title: 'Documentation',
        kind: 'external',
        href: 'https://example.com/docs',
        openInNewWindow: true,
        parentId: null,
        order: 2,
        enabled: true,
      },
    ],
    users: [
      'avery',
      'blake',
      'casey',
      'drew',
      'ellis',
      'frankie',
      'gray',
      'harper',
      'indigo',
      'jules',
      'kai',
      'lane',
    ].map((slug, index) => ({
      id: `user-${workspace}-${slug}`,
      name: `Example ${slug}`,
      email: `${slug}@${workspace}.invalid`,
      roleId: index % 2 === 0 ? roleId : auditId,
      departmentId: index % 2 === 0 ? rootId : childId,
      enabled: index !== 11,
    })),
  };
}

export const navigablePageIds = [
  'playground.home',
  'playground.request',
  'playground.examples.forms',
  'playground.examples.tables',
  'playground.examples.components',
  'playground.examples.feedback',
  'playground.examples.access',
  'playground.examples.navigation',
  'playground.examples.browser',
  'playground.examples.requests',
  'playground.examples.query',
  'playground.examples.preferences',
  'playground.examples.tabs',
  'playground.examples.tab-detail',
  'playground.examples.navigation-second',
  'playground.examples.navigation-third',
  'playground.examples.navigation-deep',
  'playground.examples.navigation-detail',

  ...systemResources.map(resource => `playground.system.${resource}`),
] as const;
