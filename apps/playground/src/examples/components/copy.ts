import { useTranslation } from '@niubu/locales/react';
import type { TranslationParams } from '@niubu/locales';

const componentsCopy = {
  pageDescription: 'Explore selection controls, context menus and tooltips.',
  choicesHelp: 'Choose the display density and notification channels, then apply your changes.',
  selectionHelp: 'A single selection sets density; multiple channels can be enabled together.',
  menuHelp: 'Open the sample menu and try its conditional actions.',
  sampleRecord: 'Sample record · demo-7',
  tooltipHelp: 'Show a short explanation without leaving the current view.',
  tooltipInteraction: 'Hover or focus the button to view the tooltip.',
  implementation: 'Implementation notes',

  title: 'Basic controls',
  help: 'Synthetic examples of the existing public components.',
  choices: 'Buttons and single / multiple choices',
  density: 'Density',
  compact: 'Compact',
  comfortable: 'Comfortable',
  channels: 'Channels',
  email: 'Email',
  sms: 'SMS',
  apply: 'Apply choices',
  reset: 'Reset choices',
  applied: 'Applied choices',
  noChoices: 'No choices applied',
  noChannels: 'None',
  menu: 'Conditional context menu',
  allowArchive: 'Allow archive action',
  contextTrigger: 'Right-click this sample',
  inspect: 'Inspect sample',
  archive: 'Archive sample',
  menuResult: 'Menu result',
  noMenuAction: 'No menu action',
  inspected: 'Inspected demo-7',
  archived: 'Archived demo-7',
  tooltipTitle: 'String tooltip',
  tooltip: 'A plain string tooltip',
  tooltipButton: 'Tooltip example',
} as const;
const componentsFallback = Object.fromEntries(
  Object.entries(componentsCopy).map(([key, value]) => [`examples.components.${key}`, value]),
);
const componentsKeys: ReadonlyMap<string, string> = new Map(
  Object.entries(componentsCopy).map(([key, value]) => [value, `examples.components.${key}`]),
);

export function useComponentsText() {
  const { t } = useTranslation('app', componentsFallback);
  return {
    t: (key: keyof typeof componentsCopy, params?: TranslationParams) => t(`examples.components.${key}`, params),
    localize: (value: string) => {
      const key = componentsKeys.get(value);
      return key ? t(key) : value;
    },
  };
}

const feedbackCopy = {
  quickTitle: 'Quick view',
  quickHelp: 'Edit a synthetic draft and check the close confirmation.',
  quickOpen: 'Open quick view',
  draftName: 'Draft name',
  previewTitle: 'Action preview',
  previewHelp: 'Review a synthetic action without sending a service request.',
  previewOpen: 'Open action preview',
  pageDescription: 'Try modal forms, confirmation queues and common page states.',
  overlaysHelp: 'Edit the same record in a modal or drawer and save your changes.',
  queueHelp: 'Complete a confirmation, followed by an alert, in sequence.',
  implementation: 'Implementation notes',

  title: 'Feedback and state examples',
  help: 'Isolated synthetic records and static state illustrations.',
  overlays: 'Modal and drawer',
  open: 'Open {{kind}}',
  savedRecord: 'Saved record',
  nothingSaved: 'Nothing saved',
  editorTitle: '{{kind}}: {{name}}',
  editorHelp: 'Synthetic typed record; closing discards this form.',
  name: 'Name',
  nameError: 'Enter a name',
  save: 'Save example',
  cancel: 'Cancel example',
  fullscreen: 'Toggle fullscreen',
  shared: 'Update shared record',
  record: 'Typed record',
  submit: 'Submit from content',
  saveFailed: 'Simulated save failed. Edit and try again.',
  scroll: 'Scrollable content sample',
  jumpFirst: 'Jump to first content row',
  jumpLast: 'Jump to last content row',
  contentRow: 'Synthetic content row {{row}}',
  queue: 'Confirm and alert queue',
  queueButton: 'Queue confirmation and alert',
  queueResult: 'Queue result',
  noQueueResult: 'No queue result',
  confirmTitle: 'Confirm sample',
  confirmHelp: 'Synthetic confirmation queued before an alert.',
  alertTitle: 'Queued alert',
  alertHelp: 'Second item in the local queue.',
  confirmed: 'Confirmed · alert completed',
  cancelled: 'Cancelled · alert completed',
  reading: 'Reading and route pending',
  tableFeedback: 'Table loading and error feedback',
  showTableLoading: 'Show table loading',
  showTableError: 'Show table error',
  showTableReady: 'Show table data',
  tableReadErrorHelp: 'Synthetic sample data is unavailable. Please retry.',

  showLoading: 'Show read loading',
  showError: 'Show read error',
  showEmpty: 'Show empty result',
  readExample: 'Read-state example',
  readAction: 'Read-state action',
  noReadAction: 'No read action',
  retried: 'Retried',
  reset: 'Filters reset',
  returned: 'Returned to sample',
  showPending: 'Show route pending',
  hidePending: 'Hide route pending',
  pendingExample: 'Route pending example',
  states: 'System states',
  showState: 'Show {{state}}',
  offline: 'Offline',
  boundaryHelp: 'RouteErrorBoundary supplies presentation and title ownership; it does not catch thrown errors.',
  stateTitle: 'State example',
  appTitle: 'Template Playground',
  denied: 'Access denied',
  deniedHelp: 'Static forbidden-page example.',
  notFound: 'Page not found',
  notFoundHelp: 'Static missing-page example.',
  error: 'Server error',
  errorHelp: 'Static error presentation; no exception is thrown.',
  offlineTitle: 'Offline example',
  offlineHelp: 'Static illustration only; no network detection.',
  footer: 'Static demonstration',
  return: 'Return to sample',
  stateAction: 'State action',
  noStateAction: 'No state action',
} as const;
const feedbackFallback = Object.fromEntries(
  Object.entries(feedbackCopy).map(([key, value]) => [`examples.feedback.${key}`, value]),
);
const feedbackKeys: ReadonlyMap<string, string> = new Map(
  Object.entries(feedbackCopy).map(([key, value]) => [value, `examples.feedback.${key}`]),
);

export function useFeedbackText() {
  const { t } = useTranslation('app', feedbackFallback);
  return {
    t: (key: keyof typeof feedbackCopy, params?: TranslationParams) => t(`examples.feedback.${key}`, params),
    localize: (value: string) => {
      const key = feedbackKeys.get(value);
      return key ? t(key) : value;
    },
  };
}
