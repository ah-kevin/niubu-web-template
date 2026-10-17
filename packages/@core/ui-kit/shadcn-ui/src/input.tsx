// Visuals follow Vben playground / Antdv Next 1.5.2; native and Radix behavior is retained.
import * as React from "react"
import { cn } from "./cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[var(--control-height)] w-full min-w-0 rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-background)] px-[var(--control-padding-inline)] py-[var(--control-padding-block)] text-[length:var(--control-font-size)] leading-[var(--control-line-height)] font-normal text-[var(--control-foreground)] transition-[color,background-color,border-color,box-shadow] duration-200 outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:border-0 file:bg-transparent file:py-0 file:text-[length:var(--control-font-size)] file:leading-[var(--control-line-height)] file:font-normal file:text-foreground placeholder:text-[var(--control-placeholder)] enabled:hover:border-[var(--control-hover-border)] disabled:cursor-not-allowed disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)]",
        "focus:border-[var(--control-focus-border)] enabled:focus:hover:border-[var(--control-focus-border)] focus:shadow-[var(--control-focus-shadow)]",
        "aria-invalid:border-destructive aria-invalid:enabled:hover:border-[var(--control-error-hover)] aria-invalid:focus:border-destructive aria-invalid:enabled:focus:hover:border-destructive aria-invalid:focus:shadow-[var(--control-error-focus-shadow)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
