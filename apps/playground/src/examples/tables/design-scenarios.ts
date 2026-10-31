export const designScenarios = [
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
] as const;
export type DesignScenario = (typeof designScenarios)[number];
export const designScenarioPath = (scenario: DesignScenario) => `/examples/tables/${scenario}`;
