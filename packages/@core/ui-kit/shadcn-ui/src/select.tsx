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
  ...triggerProps
}: SelectProps) {
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
      onValueChange={next => onValueChange(next === emptyValue ? '' : next)}
    >
      {hasEmpty && name && <input type="hidden" name={name} form={form} value={value} disabled={disabled} />}
      <SelectPrimitive.Trigger
        aria-label={label}
        {...triggerProps}
        form={form}
        name={name}
        disabled={disabled}
        className={cn('preference-select flex h-[var(--control-height)] min-w-0 max-w-full items-center justify-between gap-[calc(var(--control-spacing)/2)] rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-background)] px-[var(--control-padding-inline)] py-[var(--control-padding-block)] text-[length:var(--control-font-size)] leading-[var(--control-line-height)] font-normal text-[var(--control-foreground)] outline-none transition-[color,background-color,border-color,box-shadow] duration-200 enabled:hover:border-[var(--control-hover-border)] focus:border-[var(--control-focus-border)] enabled:focus:hover:border-[var(--control-focus-border)] focus:shadow-[var(--control-focus-shadow)] data-[placeholder]:text-[var(--control-placeholder)] aria-invalid:border-destructive aria-invalid:enabled:hover:border-[var(--control-error-hover)] aria-invalid:focus:border-destructive aria-invalid:enabled:focus:hover:border-destructive aria-invalid:focus:shadow-[var(--control-error-focus-shadow)] disabled:cursor-not-allowed disabled:bg-[var(--control-disabled-background)] disabled:text-[var(--control-disabled-foreground)]', className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon aria-hidden className="preference-select-icon inline-flex shrink-0 items-center text-[var(--control-placeholder)] [&>svg]:shrink-0">
          <ChevronDown size={12} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      {portal.ready && <SelectPrimitive.Portal container={portal.container}>
        <BusinessPortalAdmission>
        <BusinessPortalContent><SelectPrimitive.Content ref={boundaryRef} position="popper" className="preference-select-content z-[80] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-[var(--control-radius)] bg-popover p-1 text-[length:var(--control-font-size)] leading-[var(--control-line-height)] text-[var(--control-foreground)] shadow-[var(--popup-shadow)]">
          <SelectPrimitive.Viewport>
            {options.map(option => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value === '' ? emptyValue : option.value}
                disabled={option.disabled}
                className="preference-select-item relative flex min-h-[var(--control-height)] cursor-pointer items-center justify-between gap-[calc(var(--control-spacing)/2)] rounded-[var(--control-radius-sm)] px-[var(--control-spacing-sm)] py-[calc(var(--control-padding-block)+1px)] outline-none data-[disabled]:pointer-events-none data-[disabled]:text-[var(--control-disabled-foreground)] data-[highlighted]:bg-[var(--control-hover-background)] data-[state=checked]:bg-[var(--control-selected-background)] data-[state=checked]:font-semibold"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator aria-hidden className="preference-select-icon inline-flex shrink-0 items-center text-[var(--control-primary)] [&>svg]:shrink-0">
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
