import { OverlayFrame } from './OverlayFrame';
import type { DrawerProps } from './types';

export function Drawer(props: DrawerProps) {
  return <OverlayFrame {...props} variant="drawer" />;
}
