import type { ReactNode } from 'react';

export type OverlayCloseReason = 'escape' | 'outside' | 'button';

export type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  confirmLoading?: boolean;
  fullscreen?: boolean;
  /** Requests submission by the existing form owner; no save lifecycle is created here. */
  onConfirm?: () => void;
  onRequestClose?: (reason: OverlayCloseReason) => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type ModalProps = OverlayProps & { size?: 'default' | 'wide' };
export type DrawerProps = OverlayProps & { size?: 'default' | 'wide' };
export type OverlayOptions = {
  tone?: 'default' | 'danger' | 'warning';
  title: ReactNode;
  description?: ReactNode;
  signal?: AbortSignal;
};
export type OverlayApi = {
  confirm: (options: OverlayOptions) => Promise<boolean>;
  alert: (options: OverlayOptions) => Promise<void>;
};
