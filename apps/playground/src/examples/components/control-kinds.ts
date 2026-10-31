export const controlGalleryTitles = {
  Button: 'buttonsTitle',
  Input: 'textTitle',
  Textarea: 'textareaTitle',
  NumberInput: 'numberTitle',
  Select: 'selectTitle',
  Checkbox: 'checkboxTitle',
  Radio: 'radioTitle',
  Switch: 'switchTitle',
  Slider: 'sliderTitle',
  Tabs: 'tabsTitle',
  Badge: 'badgeTitle',
  Card: 'cardTitle',
  Divider: 'dividerTitle',
  Pagination: 'paginationTitle',
  ScrollArea: 'scrollTitle',
  Label: 'labelTitle',
} as const;
export type ControlGalleryKind = keyof typeof controlGalleryTitles;

export type BaseControlKind = ControlGalleryKind | 'FormField';
export const feedbackControlKinds = [
  'Modal',
  'ConfirmDialog',
  'Drawer',
  'Popover',
  'Tooltip',
  'DropdownMenu',
  'ContextMenu',
  'EmptyState',
  'Loading',
] as const;
export type FeedbackControlKind = (typeof feedbackControlKinds)[number];
