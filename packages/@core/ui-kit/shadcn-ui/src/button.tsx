// Visuals follow Vben playground / Antdv Next 1.5.2; native and Radix behavior is retained.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./cn"
import { Slot } from "radix-ui"
import { LoaderCircle } from '@niubu/icons'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-[calc(var(--control-spacing)/2)] rounded-[var(--control-radius)] border text-[length:var(--control-font-size)] leading-[var(--control-line-height)] font-normal whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-200 outline-none focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[var(--control-primary-border)] disabled:pointer-events-none disabled:border-[var(--control-border)] disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)] disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1em]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--control-primary)] text-primary-foreground shadow-[var(--control-primary-shadow)] hover:bg-primary-hover active:bg-primary-active not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-primary not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-primary-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:bg-primary-hover not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:bg-primary-active not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:bg-primary not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-primary-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:border-transparent",
        destructive: "border-transparent bg-destructive text-primary-foreground shadow-[var(--control-error-shadow)] hover:bg-[var(--control-error-hover)] active:bg-[var(--control-error-active)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-destructive-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:bg-[var(--control-error-hover)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:bg-[var(--control-error-active)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:bg-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-destructive-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:border-transparent",
        outline: "border-[var(--control-border)] bg-[var(--control-background)] text-[var(--control-foreground)] shadow-[var(--control-default-shadow)] hover:border-[var(--control-hover-border)] hover:text-[var(--control-hover-border)] active:border-primary-active active:text-primary-active not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:border-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-card not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:border-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:border-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:bg-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:bg-card not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:border-border",
        secondary: "border-transparent bg-[var(--control-hover-background)] text-[var(--control-foreground)] hover:bg-[var(--control-fill-secondary)] active:bg-[var(--control-fill)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:bg-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:bg-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-foreground",
        ghost: "border-transparent bg-transparent text-[var(--control-foreground)] hover:bg-[var(--control-hover-background)] active:bg-[var(--control-fill)] disabled:border-transparent disabled:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:bg-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:border-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:border-transparent",
        link: "border-transparent bg-transparent text-[var(--control-primary)] hover:text-primary-hover active:text-primary-active disabled:border-transparent disabled:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-primary-text not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:text-primary-text not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:underline not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:active:text-primary-text-pressed not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:border-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-primary-text not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:border-transparent",
        'link-danger': 'border-transparent bg-transparent text-destructive-text enabled:hover:underline enabled:active:text-[var(--control-error-active)] disabled:border-transparent disabled:bg-transparent disabled:text-disabled-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:border-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:bg-transparent not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:aria-busy:text-destructive-text',
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
  loading,
  children,
  disabled,
  onClick,
  onClickCapture,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const compactFocus = size === 'xs' || size === 'sm' || size?.startsWith('icon');
  const Comp = asChild ? Slot.Root : "button"
  const content = loading === undefined ? children : [
    <span key="indicator" aria-hidden="true" className="inline-flex size-[1em] shrink-0">
      <LoaderCircle className={cn('size-full motion-reduce:animate-none', loading ? 'animate-spin' : 'invisible')} />
    </span>,
    <Slot.Slottable key="content">{children}</Slot.Slottable>,
  ];

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn('not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:font-medium not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:shadow-none not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus-visible:outline-2 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus-visible:outline-solid not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus-visible:outline-focus-ring not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus-visible:outline-offset-2 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:pointer-events-auto not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:cursor-not-allowed not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:shadow-none not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:border-border not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:not-aria-busy:text-disabled-foreground',
buttonVariants({ variant, size }), compactFocus && "not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus-visible:outline-offset-1", className)}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading ?? props['aria-busy']}
      aria-disabled={loading || props['aria-disabled']}
      onClickCapture={event => {
        if (loading) { event.preventDefault(); event.stopPropagation(); return; }
        onClickCapture?.(event);
      }}
      onClick={event => {
        if (loading) { event.preventDefault(); return; }
        onClick?.(event);
      }}
    >
      {content}
    </Comp>
  )
}

export { Button }
