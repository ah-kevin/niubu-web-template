import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { useOverlayBoundaryRef } from './overlay-ownership';
export function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const boundaryRef = useOverlayBoundaryRef<HTMLDivElement>();
  const portal = useBusinessPortalContainer();
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        {portal.ready && <TooltipPrimitive.Portal container={portal.container}>
        <BusinessPortalAdmission>
          <BusinessPortalContent><TooltipPrimitive.Content ref={boundaryRef} className="preference-tooltip z-[90] max-w-[280px] rounded-[var(--radius)] border border-border bg-popover px-3 py-2 text-[length:var(--workspace-caption-font-size)] leading-relaxed text-popover-foreground shadow-sm" sideOffset={5}>
            {content}
            <TooltipPrimitive.Arrow className="fill-popover" />
          </TooltipPrimitive.Content></BusinessPortalContent>
        </BusinessPortalAdmission>
      </TooltipPrimitive.Portal>}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
