import type { ReactNode } from 'react';
import type { NotificationOptions, OverlayRenderer, SearchOptions } from './types';
export type FoundationToolsProps = {
  sessionKey: unknown;
  headerAvailable: boolean;
  headerTarget: HTMLElement | null;
  onRefresh?: () => void;
  shortcutsEnabled?: boolean;
  /** Use a direct light/dark toggle and compact locale menu. Defaults to the existing dialogs. */
  quickAppearance?: boolean;
  search: SearchOptions;
  notifications: NotificationOptions;
  renderPreferences: OverlayRenderer;
  identityNote?: ReactNode;
};
