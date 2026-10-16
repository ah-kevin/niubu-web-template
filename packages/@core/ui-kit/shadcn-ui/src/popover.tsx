import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from './cn';
import { useOverlayBoundaryRef } from './overlay-ownership';
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;
export function PopoverContent({
  ref,
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  const portal = useBusinessPortalContainer();
  if (!portal.ready) return null;
  return (
    <PopoverPrimitive.Portal container={portal.container}>
        <BusinessPortalAdmission>
      <BusinessPortalContent><PopoverPrimitive.Content
        {...props}
        ref={boundaryRef}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
          className,
        )}
      /></BusinessPortalContent>
    </BusinessPortalAdmission>
      </PopoverPrimitive.Portal>
  );
}
