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
        className={cn('preference-select flex h-[var(--workspace-control-height,36px)] min-w-[145px] max-w-full items-center justify-between gap-3 rounded-md border border-input bg-card px-3 py-1 text-[length:var(--workspace-body-font-size,0.875rem)] text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50', className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon aria-hidden className="preference-select-icon inline-flex shrink-0 items-center [&>svg]:shrink-0">
          <ChevronDown size={16} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      {portal.ready && <SelectPrimitive.Portal container={portal.container}>
        <BusinessPortalAdmission>
        <BusinessPortalContent><SelectPrimitive.Content ref={boundaryRef} position="popper" className="preference-select-content z-[80] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-md border border-border bg-card text-[length:var(--workspace-body-font-size,0.875rem)] text-foreground shadow-lg">
          <SelectPrimitive.Viewport>
            {options.map(option => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value === '' ? emptyValue : option.value}
                disabled={option.disabled}
                className="preference-select-item flex justify-between gap-[12px] px-[12px] py-[7px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-foreground"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator aria-hidden className="preference-select-icon inline-flex shrink-0 items-center [&>svg]:shrink-0">
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
