import * as React from 'react';
import { Check, ChevronRight } from '@niubu/icons';
import { ContextMenu as ContextPrimitive } from 'radix-ui';
import { BusinessPortalAdmission, BusinessPortalContent, useBusinessPortalContainer } from './business-portal-boundary';
import { useOverlayBoundaryRef } from './overlay-ownership';
import { cn } from './cn';
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from './menu-styles';

export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export const ContextMenuGroup = ContextPrimitive.Group;
export const ContextMenuRadioGroup = ContextPrimitive.RadioGroup;
export const ContextMenuSub = ContextPrimitive.Sub;

export function ContextMenuPortal({ container, ...props }: React.ComponentProps<typeof ContextPrimitive.Portal>) {
  const portal = useBusinessPortalContainer(container);
  if (!portal.ready) return null;
  return <ContextPrimitive.Portal {...props} container={portal.container} />;
}

export function ContextMenuContent({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.Content>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return (
    <BusinessPortalAdmission>
      <BusinessPortalContent>
        <ContextPrimitive.Content {...props} ref={boundaryRef} className={cn(menuContentClass, className)} />
      </BusinessPortalContent>
    </BusinessPortalAdmission>
  );
}

export function ContextMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ContextPrimitive.Item> & { variant?: 'default' | 'danger' }) {
  return <ContextPrimitive.Item data-variant={variant} {...props} className={cn(menuItemClass, className)} />;
}

export function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.CheckboxItem>) {
  return (
    <ContextPrimitive.CheckboxItem {...props} className={cn(menuItemClass, 'pl-8', className)}>
      <span className="absolute left-2 inline-flex items-center">
        <ContextPrimitive.ItemIndicator>
          <Check aria-hidden="true" />
        </ContextPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextPrimitive.CheckboxItem>
  );
}

export function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.RadioItem>) {
  return (
    <ContextPrimitive.RadioItem {...props} className={cn(menuItemClass, 'pl-8', className)}>
      <span className="absolute left-2 inline-flex items-center">
        <ContextPrimitive.ItemIndicator>
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
        </ContextPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextPrimitive.RadioItem>
  );
}

export function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.SubTrigger>) {
  return (
    <ContextPrimitive.SubTrigger {...props} className={cn(menuItemClass, 'data-[state=open]:bg-muted', className)}>
      {children}
      <ChevronRight aria-hidden="true" className="ml-auto text-muted-foreground" />
    </ContextPrimitive.SubTrigger>
  );
}

export function ContextMenuSubContent({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.SubContent>) {
  const boundaryRef = useOverlayBoundaryRef(ref);
  return (
    <ContextMenuPortal>
      <BusinessPortalAdmission>
        <BusinessPortalContent>
          <ContextPrimitive.SubContent {...props} ref={boundaryRef} className={cn(menuContentClass, className)} />
        </BusinessPortalContent>
      </BusinessPortalAdmission>
    </ContextMenuPortal>
  );
}

export function ContextMenuLabel({ className, ...props }: React.ComponentProps<typeof ContextPrimitive.Label>) {
  return <ContextPrimitive.Label {...props} className={cn(menuLabelClass, className)} />;
}

export function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextPrimitive.Separator>) {
  return <ContextPrimitive.Separator {...props} className={cn(menuSeparatorClass, className)} />;
}
