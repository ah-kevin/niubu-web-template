import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { ContextMenu as ContextPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
import { cn } from './cn';
export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export function ContextMenuContent({ ref, className, ...props }: React.ComponentProps<typeof ContextPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return <BusinessPortalAdmission><BusinessPortalContent><ContextPrimitive.Content {...props} ref={boundaryRef} className={cn('z-[80] min-w-40 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius)] border border-border bg-popover p-1 text-[length:var(--workspace-body-font-size)] text-popover-foreground shadow-sm outline-none', className)} /></BusinessPortalContent></BusinessPortalAdmission>;
}
export function ContextMenuItem({ className, ...props }: React.ComponentProps<typeof ContextPrimitive.Item>) {
  return <ContextPrimitive.Item {...props} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-[calc(var(--radius)*.75)] px-3 py-2 transition-colors outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground', className)} />;
}
export function ContextMenuPortal({ container, ...props }: React.ComponentProps<typeof ContextPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <ContextPrimitive.Portal {...props} container={portal.container} />;
}
