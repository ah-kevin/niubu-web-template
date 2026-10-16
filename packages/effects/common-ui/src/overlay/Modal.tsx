import { OverlayFrame } from './OverlayFrame';
import type { ModalProps } from './types';

export function Modal(props: ModalProps) {
  return <OverlayFrame {...props} variant="modal" />;
}
