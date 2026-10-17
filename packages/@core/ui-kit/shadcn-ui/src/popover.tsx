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
          'z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-4 text-sm text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
      /></BusinessPortalContent>
    </BusinessPortalAdmission>
      </PopoverPrimitive.Portal>
  );
}
