import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { DropdownMenu as DropdownPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
import { cn } from './cn';
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export function DropdownMenuContent({ ref, className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return <BusinessPortalAdmission><BusinessPortalContent><DropdownPrimitive.Content {...props} ref={boundaryRef} className={cn('z-[80] min-w-40 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card p-1 text-sm text-foreground shadow-lg outline-none', className)} /></BusinessPortalContent></BusinessPortalAdmission>;
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Item>) {
  return <DropdownPrimitive.Item {...props} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground', className)} />;
}
export function DropdownMenuPortal({ container, ...props }: React.ComponentProps<typeof DropdownPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <DropdownPrimitive.Portal {...props} container={portal.container} />;
}
