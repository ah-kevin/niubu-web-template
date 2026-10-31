import * as React from 'react';
import { Check, ChevronRight } from '@niubu/icons';
import { DropdownMenu as DropdownPrimitive } from 'radix-ui';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { useOverlayBoundaryRef } from './overlay-ownership';
import { cn } from './cn';
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from './menu-styles';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;
export const DropdownMenuSub = DropdownPrimitive.Sub;

export function DropdownMenuPortal({ container, ...props }: React.ComponentProps<typeof DropdownPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <DropdownPrimitive.Portal {...props} container={portal.container} />;
}

export function DropdownMenuContent({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return (
    <BusinessPortalAdmission>
      <BusinessPortalContent>
        <DropdownPrimitive.Content {...props} ref={boundaryRef} className={cn(menuContentClass, className)} />
      </BusinessPortalContent>
    </BusinessPortalAdmission>
  );
}

export function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Item> & { variant?: 'default' | 'danger' }) {
  return <DropdownPrimitive.Item data-variant={variant} {...props} className={cn(menuItemClass, className)} />;
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem {...props} className={cn(menuItemClass, 'pl-8', className)}>
      <span className="absolute left-2 inline-flex items-center">
        <DropdownPrimitive.ItemIndicator>
          <Check aria-hidden="true" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.RadioItem>) {
  return (
    <DropdownPrimitive.RadioItem {...props} className={cn(menuItemClass, 'pl-8', className)}>
      <span className="absolute left-2 inline-flex items-center">
        <DropdownPrimitive.ItemIndicator>
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.SubTrigger>) {
  return (
    <DropdownPrimitive.SubTrigger {...props} className={cn(menuItemClass, 'data-[state=open]:bg-muted', className)}>
      {children}
      <ChevronRight aria-hidden="true" className="ml-auto text-muted-foreground" />
    </DropdownPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.SubContent>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return (
    <DropdownMenuPortal>
      <BusinessPortalAdmission>
        <BusinessPortalContent>
          <DropdownPrimitive.SubContent {...props} ref={boundaryRef} className={cn(menuContentClass, className)} />
        </BusinessPortalContent>
      </BusinessPortalAdmission>
    </DropdownMenuPortal>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label {...props} className={cn(menuLabelClass, className)} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator {...props} className={cn(menuSeparatorClass, className)} />;
}
