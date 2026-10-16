import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { DropdownMenu as DropdownPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export function DropdownMenuContent({ ref, ...props }: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return <BusinessPortalAdmission><BusinessPortalContent><DropdownPrimitive.Content {...props} ref={boundaryRef} /></BusinessPortalContent></BusinessPortalAdmission>;
}
export const DropdownMenuItem = DropdownPrimitive.Item;
export function DropdownMenuPortal({ container, ...props }: React.ComponentProps<typeof DropdownPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <DropdownPrimitive.Portal {...props} container={portal.container} />;
}
