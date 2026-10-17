import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { ContextMenu as ContextPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
import { cn } from './cn';
export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export function ContextMenuContent({ ref, className, ...props }: React.ComponentProps<typeof ContextPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return <BusinessPortalAdmission><BusinessPortalContent><ContextPrimitive.Content {...props} ref={boundaryRef} className={cn('z-[80] min-w-32 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', className)} /></BusinessPortalContent></BusinessPortalAdmission>;
}
export function ContextMenuItem({ className, ...props }: React.ComponentProps<typeof ContextPrimitive.Item>) {
  return <ContextPrimitive.Item {...props} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground', className)} />;
}
export function ContextMenuPortal({ container, ...props }: React.ComponentProps<typeof ContextPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <ContextPrimitive.Portal {...props} container={portal.container} />;
}
