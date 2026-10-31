// Visuals follow Vben playground / Antdv Next 1.5.2; native and Radix behavior is retained.
import * as React from 'react';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { Check, ChevronDown } from '@niubu/icons';
import { Select as SelectPrimitive } from 'radix-ui';
import { cn } from './cn';
import { useOverlayBoundaryRef } from './overlay-ownership';

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = Omit<
  React.ComponentProps<typeof SelectPrimitive.Trigger>,
  'value' | 'defaultValue' | 'children'
> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
};
export function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  name,
  form,
  className,
  ref,
  ...triggerProps
}: SelectProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  React.useImperativeHandle(ref, () => triggerRef.current!, []);
  const [shellContent, setShellContent] = React.useState(false);
  const boundaryRef = useOverlayBoundaryRef<HTMLDivElement>();
  const portal = useBusinessPortalContainer();
  const uniqueId = React.useId();
  let emptyValue = `__empty_${uniqueId}`;
  while (options.some(option => option.value === emptyValue)) emptyValue += '_';
  const hasEmpty = options.some(option => option.value === '');
  return (
    <SelectPrimitive.Root
      name={hasEmpty ? undefined : name}
      form={form}
      disabled={disabled}
      value={value === '' && hasEmpty ? emptyValue : value}
      onOpenChange={open => {
        if (open) setShellContent(!!triggerRef.current?.closest('.preference-drawer, .workspace-header, .desktop-sidebar, .layout-secondary-pane, .layout-recovery, [data-theme-region]'));
      }}
      onValueChange={next => {
        // Radix's native form bridge can emit '' before portal options register during a controlled reset.
        // Actual empty choices use emptyValue, so this synthetic value must not overwrite the owner.
        if (next !== '') onValueChange(next === emptyValue ? '' : next);
      }}
    >
      {hasEmpty && name && <input type="hidden" name={name} form={form} value={value} disabled={disabled} />}
      <SelectPrimitive.Trigger
        ref={triggerRef}
        data-slot="select"
        aria-label={label}
        {...triggerProps}
        form={form}
        name={name}
        disabled={disabled}
        className={cn('not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:bg-card not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[placeholder]:text-muted-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:text-disabled-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:disabled:cursor-not-allowed not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:hover:border-primary-hover not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus:border-ring not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:enabled:focus:hover:border-ring not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus:shadow-none not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus:outline-2 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus:outline-solid not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus:outline-focus-ring not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:focus:outline-offset-1 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:aria-invalid:border-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:aria-invalid:enabled:hover:border-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:aria-invalid:focus:border-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:aria-invalid:enabled:focus:hover:border-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:aria-invalid:focus:shadow-none not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:aria-invalid:focus:outline-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[invalid]:border-destructive not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[invalid]:focus:outline-destructive', 'preference-select flex h-[var(--control-height)] min-w-0 max-w-full items-center justify-between gap-[calc(var(--control-spacing)/2)] rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-background)] px-[var(--control-padding-inline)] py-[var(--control-padding-block)] text-[length:var(--control-font-size)] leading-[var(--control-line-height)] font-normal text-[var(--control-foreground)] outline-none transition-[color,background-color,border-color,box-shadow] duration-200 enabled:hover:border-[var(--control-hover-border)] focus:border-[var(--control-focus-border)] enabled:focus:hover:border-[var(--control-focus-border)] focus:shadow-[var(--control-focus-shadow)] data-[placeholder]:text-[var(--control-placeholder)] aria-invalid:border-destructive aria-invalid:enabled:hover:border-[var(--control-error-hover)] aria-invalid:focus:border-destructive aria-invalid:enabled:focus:hover:border-destructive aria-invalid:focus:shadow-[var(--control-error-focus-shadow)] disabled:cursor-not-allowed disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)]', className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon aria-hidden className="preference-select-icon not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-muted-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:in-data-[state=open]:rotate-180 not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:in-disabled:text-disabled-foreground inline-flex shrink-0 items-center text-[var(--control-placeholder)] [&>svg]:shrink-0">
          <ChevronDown size={12} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      {portal.ready && <SelectPrimitive.Portal container={portal.container}>
        <BusinessPortalAdmission>
        <BusinessPortalContent><SelectPrimitive.Content ref={boundaryRef} data-control-shell={shellContent ? '' : undefined} position="popper" className="not-data-[control-shell]:border not-data-[control-shell]:border-border preference-select-content z-[80] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-[var(--control-radius)] bg-popover p-1 text-[length:var(--control-font-size)] leading-[var(--control-line-height)] text-[var(--control-foreground)] shadow-[var(--popup-shadow)]">
          <SelectPrimitive.Viewport>
            {options.map(option => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value === '' ? emptyValue : option.value}
                disabled={option.disabled}
                className="not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[highlighted]:bg-muted not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[state=checked]:bg-[var(--nav-active)] not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[state=checked]:text-nav-active-foreground not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[state=checked]:font-medium not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:data-[disabled]:text-disabled-foreground preference-select-item relative flex min-h-[var(--control-height)] cursor-pointer items-center justify-between gap-[calc(var(--control-spacing)/2)] rounded-[var(--control-radius-sm)] px-[var(--control-spacing-sm)] py-[calc(var(--control-padding-block)+1px)] outline-none data-[disabled]:pointer-events-none data-[disabled]:text-[var(--control-disabled-foreground)] data-[highlighted]:bg-[var(--control-hover-background)] data-[state=checked]:bg-[var(--control-selected-background)] data-[state=checked]:font-semibold"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator aria-hidden className="preference-select-icon not-in-[.preference-drawer,.workspace-header,.desktop-sidebar,.layout-secondary-pane,.layout-recovery,[data-theme-region],[data-control-shell]]:text-nav-active-foreground inline-flex shrink-0 items-center text-[var(--control-primary)] [&>svg]:shrink-0">
                  <Check size={16} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content></BusinessPortalContent>
      </BusinessPortalAdmission>
      </SelectPrimitive.Portal>}
    </SelectPrimitive.Root>
  );
}
