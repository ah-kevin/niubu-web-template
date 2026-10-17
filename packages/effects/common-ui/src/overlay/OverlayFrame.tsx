import { Suspense, useRef, type CSSProperties } from 'react';
import { Button } from '@niubu/shadcn-ui/button';
import { X } from '@niubu/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@niubu/shadcn-ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@niubu/shadcn-ui/sheet';
import { PendingOverlay } from '@niubu/shadcn-ui/pending-overlay';
import { useOverlayLabels } from './OverlayContext';
import type { OverlayCloseReason, OverlayProps } from './types';

const fullscreenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100vw',
  height: '100dvh',
  maxWidth: 'none',
  maxHeight: 'none',
  transform: 'none',
  translate: 'none',
  borderRadius: 0,
};

export function OverlayFrame({
  variant,
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  confirmLoading = false,
  fullscreen = false,
  onConfirm,
  onRequestClose,
  confirmLabel,
  cancelLabel,
}: OverlayProps & { variant: 'modal' | 'drawer' }) {
  const labels = useOverlayLabels();
  const previousFocus = useRef<HTMLElement | null>(null);
  const Root = variant === 'modal' ? Dialog : Sheet;
  const Content = variant === 'modal' ? DialogContent : SheetContent;
  const Header = variant === 'modal' ? DialogHeader : SheetHeader;
  const Title = variant === 'modal' ? DialogTitle : SheetTitle;
  const Description = variant === 'modal' ? DialogDescription : SheetDescription;
  const Footer = variant === 'modal' ? DialogFooter : SheetFooter;
  function requestClose(reason: OverlayCloseReason) {
    if (onRequestClose) onRequestClose(reason);
    else onOpenChange(false);
  }
  const hasDescription = description !== undefined && description !== null;
  const actions =
    footer !== undefined ? (
      footer
    ) : onConfirm ? (
      <>
        <Button type="button" variant="outline" onClick={() => requestClose('button')}>
          {cancelLabel ?? labels.cancel}
        </Button>
        <Button
          type="button"
          disabled={confirmLoading}
          aria-busy={confirmLoading}
          onClick={() => {
            if (!confirmLoading) onConfirm();
          }}
        >
          {confirmLabel ?? labels.confirm}
        </Button>
      </>
    ) : null;
  return (
    <Root
      open={open}
      onOpenChange={next => {
        if (next) onOpenChange(true);
        else requestClose('button');
      }}
    >
      {open && (
        <Suspense fallback={<PendingOverlay onCancel={() => requestClose('escape')} />}>
          <Content
            className={
              variant === 'modal'
                ? 'pattern-overlay pattern-overlay-modal flex max-h-[calc(90dvh-1rem)] flex-col gap-0 overflow-hidden p-0'
                : 'pattern-overlay pattern-overlay-drawer flex max-h-dvh flex-col gap-0 overflow-hidden sm:max-w-lg [@media(max-width:700px)]:w-full [@media(max-width:700px)]:max-w-full'
            }
            showCloseButton={false}
            data-fullscreen={fullscreen || undefined}
            style={fullscreen ? fullscreenStyle : undefined}
            {...(!hasDescription ? { 'aria-describedby': undefined } : {})}
            onOpenAutoFocus={() => {
              previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={event => {
              event.preventDefault();
              if (previousFocus.current?.isConnected) previousFocus.current.focus();
            }}
            onEscapeKeyDown={event => {
              event.preventDefault();
              requestClose('escape');
            }}
            onPointerDownOutside={event => {
              event.preventDefault();
              requestClose('outside');
            }}
          >
            <Header className="shrink-0 pe-14 text-start">
              <Title>{title}</Title>
              {hasDescription && <Description>{description}</Description>}
            </Header>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 size-8"
              aria-label={labels.close}
              onClick={() => requestClose('button')}
            >
              <X aria-hidden="true" size={16} />
            </Button>
            <div className="pattern-overlay-content min-h-0 flex-1 overflow-auto overscroll-contain p-3">
              <div className="min-h-40">{children}</div>
            </div>
            {actions !== null && actions !== false && <Footer className="shrink-0">{actions}</Footer>}
          </Content>
        </Suspense>
      )}
    </Root>
  );
}
