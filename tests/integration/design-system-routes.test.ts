import { expect, it } from 'vitest';
import type { BackendMenuItem } from '@niubu/types';
import { registry } from '../../apps/playground/src/modules/demo';
import { examplesMenu } from '../../apps/backend-mock/src/fixtures';

const scenarios = [
  'choose',
  'read',
  'actions',
  'selection',
  'single',
  'layout',
  'header',
  'expand',
  'edit',
  'merge',
  'drag',
  'states',
  'tree',
];
function pageIds(items: readonly BackendMenuItem[]): string[] {
  return items.flatMap(item =>
    item.kind === 'group' ? pageIds(item.children) : item.kind === 'page' ? [item.pageId] : [],
  );
}
it('connects every design scenario from the real mock menu to a granted route and concrete loader', async () => {
  const menu = pageIds([examplesMenu]);
  for (const scenario of scenarios) {
    const id = `playground.design.${scenario}`;
    const path = `/examples/tables/${scenario}`;
    expect(
      menu.filter(value => value === id),
      id,
    ).toHaveLength(1);
    expect(registry.routes.find(route => route.id === id)).toMatchObject({
      path,
      scope: 'workspace',
      requiredCodes: ['demo:read'],
      navigation: true,
    });
    expect((await registry.loaders[path]!()).Component).toBeTypeOf('function');
  }
  expect(menu.filter(value => value === 'playground.examples.complete-list')).toHaveLength(1);
  expect((await registry.loaders['/examples/complete-list']!()).Component).toBeTypeOf('function');
});

it('provides a separate menu and route for each basic and feedback component with varied icons', async () => {
  const menu = pageIds([examplesMenu]);
  const base = [
    'button',
    'input',
    'textarea',
    'number-input',
    'select',
    'checkbox',
    'radio',
    'switch',
    'slider',
    'tabs',
    'badge',
    'card',
    'divider',
    'pagination',
    'scroll-area',
    'label',
    'form-field',
  ];
  const feedback = [
    'modal',
    'confirm-dialog',
    'drawer',
    'popover',
    'tooltip',
    'dropdown-menu',
    'context-menu',
    'empty-state',
    'loading',
  ];
  const icons = new Set<string | undefined>();
  for (const [group, names, prefix] of [
    ['base', base, 'components'],
    ['feedback', feedback, 'feedback'],
  ] as const) {
    for (const slug of names) {
      const id = `playground.design.${group}.${slug}`;
      const path = `/examples/${prefix}/${slug}`;
      expect(
        menu.filter(value => value === id),
        id,
      ).toHaveLength(1);
      const route = registry.routes.find(route => route.id === id);
      expect(route).toMatchObject({ path, navigation: true, scope: 'workspace' });
      icons.add(route?.iconToken);
      expect((await registry.loaders[path]!()).Component).toBeTypeOf('function');
    }
  }
  expect(icons.size).toBeGreaterThan(10);
  expect(examplesMenu.children.filter(item => item.kind === 'group').map(item => item.id)).toEqual([
    'design-basics',
    'design-feedback',
    'design-table-scenarios',
    'design-overviews',
  ]);
});
