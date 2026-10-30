import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@niubu/shadcn-ui/dropdown-menu';

type RowActionBase = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
};
/** An action either runs a callback or navigates; a disabled navigation action is rendered inert, never as a link. */
export type RowAction = RowActionBase &
  ({ onSelect: () => void; href?: undefined } | { href: string; onSelect?: undefined });
/** Wraps the label in the caller's router link. Must return one element that accepts a forwarded ref and props. */
export type RowActionLink = (href: string, label: ReactNode) => ReactElement;
export type RowActionsProps = {
  actions: readonly RowAction[];
  /** Caller-owned identity, scope, generation and row boundary. Changing it retires open or pending work. */
  ownerKey: string;
  rowLabel: string;
  moreLabel?: string;
  /** Renders `href` actions with the app's router link; defaults to a plain anchor. */
  renderLink?: RowActionLink;
};

const anchorLink: RowActionLink = (href, label) => <a href={href}>{label}</a>;

export function RowActions({ actions, ownerKey, rowLabel, moreLabel, renderLink = anchorLink }: RowActionsProps) {
  const { t } = useTranslation();
  if (actions.some(action => !action.id.trim()) || new Set(actions.map(action => action.id)).size !== actions.length)
    throw new Error('Row action IDs must be nonempty and unique');
  if (!actions.length) return null;
  return (
    <OwnedActions
      key={ownerKey}
      actions={actions}
      moreLabel={moreLabel ?? t('common:table.moreActions')}
      moreAccessibleLabel={t('common:table.moreRowActions', { name: rowLabel })}
      renderLink={renderLink}
    />
  );
}
function OwnedActions({
  actions,
  moreLabel,
  moreAccessibleLabel,
  renderLink,
}: {
  actions: readonly RowAction[];
  moreLabel: string;
  moreAccessibleLabel: string;
  renderLink: RowActionLink;
}) {
  const [primary, ...secondary] = actions;
  const className = primary.destructive ? 'text-destructive' : undefined;
  return (
    <div data-row-action="" className="inline-flex max-w-full items-center justify-center gap-1 whitespace-nowrap">
      {primary.href !== undefined && !primary.disabled ? (
        <Button asChild variant="link" size="sm" className={className}>
          {renderLink(primary.href, primary.label)}
        </Button>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={primary.disabled}
          className={className}
          onClick={primary.onSelect}
        >
          {primary.label}
        </Button>
      )}
      {secondary.length > 0 && (
        <MoreActions
          actions={secondary}
          label={moreLabel}
          accessibleLabel={moreAccessibleLabel}
          renderLink={renderLink}
        />
      )}
    </div>
  );
}
function MoreActions({
  actions,
  label,
  accessibleLabel,
  renderLink,
}: {
  actions: readonly RowAction[];
  label: string;
  accessibleLabel: string;
  renderLink: RowActionLink;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<string | null>(null);
  const committed = useRef(actions);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    committed.current = actions;
  });
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = null;
    };
  }, []);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} type="button" variant="ghost" size="sm" aria-label={accessibleLabel}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          data-row-action=""
          align="end"
          onCloseAutoFocus={event => {
            const id = pending.current;
            pending.current = null;
            if (!id) return;
            event.preventDefault();
            // The retiring menu's FocusScope must finish before another overlay captures focus.
            queueMicrotask(() => {
              if (!mounted.current || !trigger.current?.isConnected) return;
              trigger.current.focus();
              // Focus handlers can synchronously commit new permissions or retire this owner.
              if (!mounted.current || !trigger.current?.isConnected) return;
              const action = committed.current.find(item => item.id === id);
              if (action && !action.disabled) action.onSelect?.();
            });
          }}
        >
          {actions.map(action => {
            const className = action.destructive ? 'text-destructive data-[highlighted]:text-destructive' : undefined;
            // Navigation needs no focus handoff: the link itself leaves the page or swaps the route.
            if (action.href !== undefined && !action.disabled)
              return (
                <DropdownMenuItem key={action.id} data-row-action="" asChild className={className}>
                  {renderLink(action.href, action.label)}
                </DropdownMenuItem>
              );
            return (
              <DropdownMenuItem
                key={action.id}
                data-row-action=""
                disabled={action.disabled}
                className={className}
                onSelect={() => {
                  pending.current = action.id;
                  setOpen(false);
                }}
              >
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
