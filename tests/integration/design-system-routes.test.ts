import { expect, it } from 'vitest';
import type { BackendMenuItem } from '@niubu/types';
import { registry } from '../../apps/playground/src/modules/demo';
import { examplesMenu } from '../../apps/backend-mock/src/fixtures';

const scenarios = ['choose', 'read', 'actions', 'selection', 'single', 'layout', 'header', 'expand', 'edit', 'merge', 'drag', 'states', 'tree'];
function pageIds(items: readonly BackendMenuItem[]): string[] {
  return items.flatMap(item => item.kind === 'group' ? pageIds(item.children) : item.kind === 'page' ? [item.pageId] : []);
}
it('connects every design scenario from the real mock menu to a granted route and concrete loader', async () => {
  const menu = pageIds([examplesMenu]);
  for (const scenario of scenarios) {
    const id = `playground.design.${scenario}`;
    const path = `/examples/tables/${scenario}`;
    expect(menu.filter(value => value === id), id).toHaveLength(1);
    expect(registry.routes.find(route => route.id === id)).toMatchObject({ path, scope: 'workspace', requiredCodes: ['demo:read'], navigation: true });
    expect((await registry.loaders[path]!()).Component).toBeTypeOf('function');
  }
  expect(menu.filter(value => value === 'playground.examples.complete-list')).toHaveLength(1);
  expect((await registry.loaders['/examples/complete-list']!()).Component).toBeTypeOf('function');
});
