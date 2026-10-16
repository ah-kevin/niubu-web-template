import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { ContextMenu as ContextPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export function ContextMenuContent({ ref, ...props }: React.ComponentProps<typeof ContextPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return <BusinessPortalAdmission><BusinessPortalContent><ContextPrimitive.Content {...props} ref={boundaryRef} /></BusinessPortalContent></BusinessPortalAdmission>;
}
export const ContextMenuItem = ContextPrimitive.Item;
export function ContextMenuPortal({ container, ...props }: React.ComponentProps<typeof ContextPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <ContextPrimitive.Portal {...props} container={portal.container} />;
}
