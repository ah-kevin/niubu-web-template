import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@niubu/shadcn-ui/dropdown-menu';

export type RowAction = {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};
export type RowActionsProps = {
  actions: readonly RowAction[];
  /** Caller-owned identity, scope, generation and row boundary. Changing it retires open or pending work. */
  ownerKey: string;
  rowLabel: string;
  moreLabel?: string;
};

export function RowActions({ actions, ownerKey, rowLabel, moreLabel }: RowActionsProps) {
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
    />
  );
}
function OwnedActions({
  actions,
  moreLabel,
  moreAccessibleLabel,
}: {
  actions: readonly RowAction[];
  moreLabel: string;
  moreAccessibleLabel: string;
}) {
  const [primary, ...secondary] = actions;
  return (
    <div data-row-action="" className="inline-flex max-w-full items-center justify-center gap-1 whitespace-nowrap">
      <Button
        type="button"
        variant="link"
        size="sm"
        disabled={primary.disabled}
        className={primary.destructive ? 'text-destructive' : undefined}
        onClick={primary.onSelect}
      >
        {primary.label}
      </Button>
      {secondary.length > 0 && (
        <MoreActions actions={secondary} label={moreLabel} accessibleLabel={moreAccessibleLabel} />
      )}
    </div>
  );
}
function MoreActions({
  actions,
  label,
  accessibleLabel,
}: {
  actions: readonly RowAction[];
  label: string;
  accessibleLabel: string;
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
              if (action && !action.disabled) action.onSelect();
            });
          }}
        >
          {actions.map(action => (
            <DropdownMenuItem
              key={action.id}
              data-row-action=""
              disabled={action.disabled}
              className={action.destructive ? 'text-destructive data-[highlighted]:text-destructive' : undefined}
              onSelect={() => {
                pending.current = action.id;
                setOpen(false);
              }}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
