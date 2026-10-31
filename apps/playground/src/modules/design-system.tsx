import type { ComponentType } from 'react';
import type { DomainModule, RouteMeta } from '@niubu/types';
import { designScenarios, designScenarioPath } from '../examples/tables/design-scenarios';

const routes = designScenarios.map((scenario, index) => ({
  id: `playground.design.${scenario}`,
  path: designScenarioPath(scenario),
  titleKey: `app:designSystem.${scenario}`,
  iconToken: 'database',
  order: 40 + index,
  navigation: true,
  scope: 'workspace' as const,
  capability: null,
  requiredCodes: ['demo:read'],
})) satisfies readonly RouteMeta[];

export const designSystemModule: DomainModule<RouteMeta, ComponentType> = {
  id: 'playground.design-system',
  routes,
  menus: routes.map(route => ({ pageId: route.id })),
  permissions: [],
  namespaces: ['app'],
  loaders: Object.fromEntries(
    designScenarios.map(scenario => [
      designScenarioPath(scenario),
      async () => {
        const { DesignScenarioPage } = await import('../examples/tables/DesignScenarioPage');
        return { Component: () => <DesignScenarioPage scenario={scenario} /> };
      },
    ]),
  ),
};
