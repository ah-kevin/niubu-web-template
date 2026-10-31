import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
export function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const boundaryRef = useOverlayBoundaryRef<HTMLDivElement>();
  const portal = useBusinessPortalContainer();
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        {portal.ready && (
          <TooltipPrimitive.Portal container={portal.container}>
            <BusinessPortalAdmission>
              <BusinessPortalContent>
                <TooltipPrimitive.Content
                  ref={boundaryRef}
                  className="preference-tooltip z-[var(--z-tooltip)] max-w-[var(--tooltip-max-width)] rounded-md bg-tooltip px-2 py-1 text-xs leading-[18px] text-balance text-tooltip-foreground animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fade-in-0 data-[state=closed]:zoom-out-95 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                  sideOffset={5}
                >
                  {content}
                  <TooltipPrimitive.Arrow width={8} height={4} className="w-[var(--tooltip-arrow-size)] fill-tooltip" />
                </TooltipPrimitive.Content>
              </BusinessPortalContent>
            </BusinessPortalAdmission>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
