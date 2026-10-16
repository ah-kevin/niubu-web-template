import type { ComponentProps, ReactNode } from 'react';
export type OverlayContentProps = { contentId: string; onClose: () => void; returnFocus: () => void };
export type OverlayRenderer = (props: OverlayContentProps) => ReactNode;
export type WidgetLinkProps = ComponentProps<'a'> & { href: string };
export type WidgetLinkRenderer = (props: WidgetLinkProps) => ReactNode;
export type SearchItem = { id: string; title: string; description?: string; href: string };
export type ObjectSearchResult = { status: 'ready'; data: SearchItem[] } | { status: 'error'; message: string };
export type SearchConfiguration = {
  locale: string;
  pages: readonly SearchItem[];
  loadObjects?: (signal: AbortSignal) => Promise<ObjectSearchResult>;
  renderLink: WidgetLinkRenderer;
  description?: ReactNode;
  scopeNote?: ReactNode;
};
export type SearchDialogProps = SearchConfiguration & OverlayContentProps;
export type SearchOptions = SearchConfiguration & { renderDialog?: (props: SearchDialogProps) => ReactNode };
export type NotificationItem = {
  id: string;
  title: string;
  body: ReactNode;
  source?: string;
  date?: string;
  label?: ReactNode;
  action?: { title: string; href: string };
};
export type NotificationConfiguration = {
  items: readonly NotificationItem[];
  renderLink: WidgetLinkRenderer;
  description?: ReactNode;
  explanation?: ReactNode;
};
export type NotificationDialogProps = NotificationConfiguration & OverlayContentProps;
export type NotificationOptions = NotificationConfiguration & {
  renderSheet?: (props: NotificationDialogProps) => ReactNode;
};
