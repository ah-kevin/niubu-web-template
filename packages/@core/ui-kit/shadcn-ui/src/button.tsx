// Visuals follow Vben playground / Antdv Next 1.5.2; native and Radix behavior is retained.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-[calc(var(--control-spacing)/2)] rounded-[var(--control-radius)] border text-[length:var(--control-font-size)] leading-[var(--control-line-height)] font-normal whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-200 outline-none focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[var(--control-primary-border)] disabled:pointer-events-none disabled:border-[var(--control-border)] disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)] disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1em]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--control-primary)] text-primary-foreground shadow-[var(--control-primary-shadow)] hover:bg-primary-hover active:bg-primary-active",
        destructive: "border-transparent bg-destructive text-primary-foreground shadow-[var(--control-error-shadow)] hover:bg-[var(--control-error-hover)] active:bg-[var(--control-error-active)]",
        outline: "border-[var(--control-border)] bg-[var(--control-background)] text-[var(--control-foreground)] shadow-[var(--control-default-shadow)] hover:border-[var(--control-hover-border)] hover:text-[var(--control-hover-border)] active:border-primary-active active:text-primary-active",
        secondary: "border-transparent bg-[var(--control-hover-background)] text-[var(--control-foreground)] hover:bg-[var(--control-fill-secondary)] active:bg-[var(--control-fill)]",
        ghost: "border-transparent bg-transparent text-[var(--control-foreground)] hover:bg-[var(--control-hover-background)] active:bg-[var(--control-fill)] disabled:border-transparent disabled:bg-transparent",
        link: "border-transparent bg-transparent text-[var(--control-primary)] hover:text-primary-hover active:text-primary-active disabled:border-transparent disabled:bg-transparent",
      },
      size: {
        default: "h-[var(--control-height)] px-[var(--control-button-padding-inline)] py-0",
        xs: "rounded-[var(--control-radius-sm)] h-[var(--control-height-sm)] px-[7px] py-0",
        sm: "rounded-[var(--control-radius-sm)] h-[var(--control-height-sm)] px-[7px] py-0",
        lg: "rounded-[var(--control-radius-lg)] h-[var(--control-height-lg)] px-[var(--control-button-padding-inline)] py-0 text-[length:var(--control-font-size-lg)] leading-[var(--control-line-height-lg)]",
        icon: "size-[var(--control-height)] p-0",
        "icon-xs": "rounded-[var(--control-radius-sm)] size-[var(--control-height-sm)] p-0",
        "icon-sm": "rounded-[var(--control-radius-sm)] size-[var(--control-height-sm)] p-0",
        "icon-lg": "rounded-[var(--control-radius-lg)] size-[var(--control-height-lg)] p-0 text-[length:var(--control-font-size-lg)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
