// Visuals follow the corresponding Vben framework Label primitive.
"use client"

import * as React from "react"
import { cn } from "./cn"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn('not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-[length:var(--control-font-size)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:leading-[var(--control-line-height)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[disabled]:cursor-not-allowed not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[disabled]:text-disabled-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:peer-disabled:opacity-100 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:peer-disabled:text-disabled-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:group-data-[disabled=true]:opacity-100 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:group-data-[disabled=true]:text-disabled-foreground',

        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
