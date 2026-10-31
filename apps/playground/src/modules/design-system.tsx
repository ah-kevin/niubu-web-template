import type { ComponentType } from 'react';
import type { DomainModule, RouteMeta } from '@niubu/types';
import {
  baseControlEntries,
  feedbackControlEntries,
  designScenarios,
  designScenarioPath,
  tableScenarioIcons,
} from '../examples/tables/design-scenarios';

const tableRoutes = designScenarios.map((scenario, index) => ({
  id: `playground.design.${scenario}`,
  path: designScenarioPath(scenario),
  titleKey: `app:designSystem.${scenario}`,
  iconToken: tableScenarioIcons[scenario],
  order: 40 + index,
  navigation: true,
  scope: 'workspace' as const,
  capability: null,
  requiredCodes: ['demo:read'],
}));
const baseRoutes = baseControlEntries.map(([kind, slug, icon], index) => ({
  id: `playground.design.base.${slug}`,
  path: `/examples/components/${slug}`,
  titleKey: `app:designSystem.base.${kind}`,
  iconToken: icon,
  order: index,
  navigation: true,
  scope: 'workspace' as const,
  capability: null,
  requiredCodes: ['demo:read'],
}));
const feedbackRoutes = feedbackControlEntries.map(([kind, slug, icon], index) => ({
  id: `playground.design.feedback.${slug}`,
  path: `/examples/feedback/${slug}`,
  titleKey: `app:designSystem.feedback.${kind}`,
  iconToken: icon,
  order: index,
  navigation: true,
  scope: 'workspace' as const,
  capability: null,
  requiredCodes: ['demo:read'],
}));
const routes = [...baseRoutes, ...feedbackRoutes, ...tableRoutes] satisfies readonly RouteMeta[];

export const designSystemModule: DomainModule<RouteMeta, ComponentType> = {
  id: 'playground.design-system',
  routes,
  menus: routes.map(route => ({ pageId: route.id })),
  permissions: [],
  namespaces: ['app'],
  loaders: {
    ...Object.fromEntries(
      designScenarios.map(scenario => [
        designScenarioPath(scenario),
        async () => {
          const { DesignScenarioPage } = await import('../examples/tables/DesignScenarioPage');
          return { Component: () => <DesignScenarioPage scenario={scenario} /> };
        },
      ]),
    ),
    ...Object.fromEntries(
      baseControlEntries.map(([kind, slug]) => [
        `/examples/components/${slug}`,
        async () => {
          const { BaseControlPage } = await import('../examples/components/BaseControlPage');
          return { Component: () => <BaseControlPage kind={kind} /> };
        },
      ]),
    ),
    ...Object.fromEntries(
      feedbackControlEntries.map(([kind, slug]) => [
        `/examples/feedback/${slug}`,
        async () => {
          const { FeedbackControlPage } = await import('../examples/components/FeedbackControlPage');
          return { Component: () => <FeedbackControlPage kind={kind} /> };
        },
      ]),
    ),
  },
};
