// Visuals follow Vben popup-ui and its framework primitives; Radix ownership and behavior are retained.
'use client';

import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { cn } from './cn';
import { useOverlayBoundaryRef } from './overlay-ownership';
import { XIcon } from '@niubu/icons';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@niubu/shadcn-ui/button';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ container, ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <DialogPrimitive.Portal {...props} container={portal.container} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <BusinessPortalAdmission>
      <BusinessPortalContent>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className={cn(
            'fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay-background)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
            className,
          )}
          {...props}
        />
      </BusinessPortalContent>
    </BusinessPortalAdmission>
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = '关闭',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  const boundaryRef = useOverlayBoundaryRef(props.ref);
  return (
    <DialogPortal data-slot="dialog-portal">
      <BusinessPortalAdmission>
        <DialogOverlay />
        <BusinessPortalContent>
          <DialogPrimitive.Content
            data-slot="dialog-content"
            className={cn(
              'fixed top-[50%] left-[50%] z-[var(--z-dialog)] grid w-[var(--dialog-width-md)] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] -translate-y-1/2 translate-x-[-50%] overflow-y-auto gap-0 rounded-xl border border-border bg-popover text-popover-foreground p-0 shadow-[var(--popup-shadow)] duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              className,
            )}
            {...props}
            ref={boundaryRef}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close
                data-slot="dialog-close"
                className="absolute top-2 right-2 flex size-[var(--control-height)] items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-focus-ring focus-visible:outline-offset-[length:var(--focus-ring-offset-sm)] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-[var(--control-icon-size)]"
              >
                <XIcon />
                <span className="sr-only">{closeLabel}</span>
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </BusinessPortalContent>
      </BusinessPortalAdmission>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'flex shrink-0 flex-col gap-2 border-b border-border px-[var(--popup-padding)] py-4 text-left',
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel = '关闭',
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-[var(--popup-padding)] py-4',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{closeLabel}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-heading-2 font-semibold', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
