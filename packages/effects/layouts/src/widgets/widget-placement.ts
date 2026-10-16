import type { WidgetPosition } from '@niubu/core-preferences';
export function resolveWidgetPlacement(
  position: WidgetPosition,
  headerAvailable: boolean,
): 'header' | 'fixed' | 'user-dropdown' {
  return position === 'user-dropdown'
    ? 'user-dropdown'
    : position === 'fixed'
      ? 'fixed'
      : headerAvailable
        ? 'header'
        : 'fixed';
}
