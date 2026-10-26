import { useState } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Building2, Check, ChevronDown, X } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@niubu/shadcn-ui/popover';
import { cn } from '@niubu/shadcn-ui/cn';

export type WorkspaceContextOption = { value: string; label: string; disabled?: boolean };
export type WorkspaceContextGroup = {
  value: string;
  label: string;
  options?: readonly WorkspaceContextOption[];
  disabled?: boolean;
};
export type WorkspaceContextProps = {
  label: string;
  groupLabel: string;
  rangeLabel: string;
  groupValue: string;
  value: string;
  groups: readonly WorkspaceContextGroup[];
  onGroupChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  groupActionLabel?: string;
  groupActionDescription?: string;
  appearance?: 'sidebar' | 'header';
  compact?: boolean;
};

/** Controlled context presentation; browsing another group never grants or selects its scopes. */
export function WorkspaceContext({
  label,
  groupLabel,
  rangeLabel,
  groupValue,
  value,
  groups,
  onGroupChange,
  onValueChange,
  disabled = false,
  placeholder,
  emptyLabel,
  groupActionLabel,
  groupActionDescription,
  appearance = 'sidebar',
  compact = false,
}: WorkspaceContextProps) {
  const { t } = useTranslation('common');
  const owner = groupValue + ':' + String(disabled);
  const [menu, setMenu] = useState({ owner, open: false, group: groupValue });
  if (menu.owner !== owner) setMenu({ owner, open: false, group: groupValue });
  const current = groups.find(group => group.value === groupValue);
  const selected = current?.options?.find(option => option.value === value);
  const rangeName = selected?.label ?? placeholder ?? rangeLabel;
  const fullName = (current ? current.label + ' / ' : '') + rangeName;
  const interactive = Boolean(
    (onGroupChange && groups.some(group => group.value !== groupValue && !group.disabled)) ||
    (!current?.disabled &&
      onValueChange &&
      current?.options?.some(option => option.value !== value && !option.disabled)),
  );
  const viewed = groups.find(group => group.value === menu.group) ?? current ?? groups[0];
  const expanded = menu.owner === owner && menu.open && !disabled;
  const close = () => setMenu({ owner, open: false, group: groupValue });
  const body = (
    <>
      <Building2 size={16} aria-hidden="true" className="shrink-0" />
      {compact && <span className="sr-only">{fullName}</span>}
      {!compact && (
        <span className="grid min-w-0 flex-1 gap-0.5 text-left">
          {appearance === 'sidebar' && current && (
            <span className="truncate text-xs text-muted-foreground">{current.label}</span>
          )}
          <span className="truncate text-sm">{rangeName}</span>
        </span>
      )}
      {!compact && interactive && <ChevronDown size={12} aria-hidden="true" className="shrink-0" />}
    </>
  );
  const triggerClass = cn(
    'workspace-context-trigger min-w-0 gap-2',
    compact
      ? 'size-8 justify-center p-0'
      : appearance === 'sidebar'
        ? 'h-12 w-full justify-start px-2.5 font-normal shadow-none'
        : 'max-w-44 shrink justify-start px-2',
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'workspace-context-switcher min-w-0',
        appearance === 'sidebar' ? 'w-full' : 'max-w-full',
        compact && 'flex justify-center',
      )}
    >
      {interactive ? (
        <Popover open={expanded} onOpenChange={open => setMenu({ owner, open, group: groupValue })}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={appearance === 'sidebar' && !compact ? 'outline' : 'ghost'}
              className={triggerClass}
              aria-label={label + ': ' + fullName}
              title={fullName}
              disabled={disabled}
            >
              {body}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            collisionPadding={8}
            aria-label={label}
            className={cn(
              'workspace-context-popover max-h-[min(24rem,var(--radix-popover-content-available-height))] max-w-[calc(100vw-1rem)] overflow-y-auto p-0',
              groups.length > 1 ? 'w-[380px]' : 'w-72',
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <span className="font-medium">{label}</span>
              <PopoverClose asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t('close')}>
                  <X size={14} aria-hidden="true" />
                </Button>
              </PopoverClose>
            </div>
            <div className={cn('grid min-w-0', groups.length > 1 && 'grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
              {groups.length > 1 && (
                <section aria-label={groupLabel} className="min-w-0 border-r border-border p-2">
                  <p className="px-2 pb-1 text-xs text-muted-foreground">{groupLabel}</p>
                  <div className="grid max-h-64 gap-1 overflow-y-auto">
                    {groups.map(group => (
                      <Button
                        key={group.value}
                        type="button"
                        variant="ghost"
                        className={cn(
                          'h-auto min-h-9 w-full min-w-0 justify-between gap-2 whitespace-normal px-2 py-2 text-left font-normal',
                          viewed?.value === group.value && 'bg-accent text-accent-foreground',
                        )}
                        aria-pressed={viewed?.value === group.value}
                        disabled={disabled || group.disabled || (!onGroupChange && group.value !== groupValue)}
                        onClick={() => setMenu({ owner, open: true, group: group.value })}
                      >
                        <span className="min-w-0 break-words">{group.label}</span>
                        <ChevronDown size={12} aria-hidden="true" className="-rotate-90" />
                      </Button>
                    ))}
                  </div>
                </section>
              )}
              <section aria-label={rangeLabel} className="min-w-0 p-2">
                <p className="px-2 pb-1 text-xs text-muted-foreground">{rangeLabel}</p>
                {viewed?.value === groupValue ? (
                  <div className="grid max-h-64 gap-1 overflow-y-auto">
                    {current?.options?.length ? (
                      current.options.map(option => (
                        <Button
                          key={option.value}
                          type="button"
                          variant="ghost"
                          className={cn(
                            'h-auto min-h-9 w-full min-w-0 justify-between gap-2 whitespace-normal px-2 py-2 text-left font-normal',
                            option.value === value && 'bg-accent text-accent-foreground',
                          )}
                          aria-pressed={option.value === value}
                          disabled={disabled || current.disabled || option.disabled || !onValueChange}
                          onClick={() => {
                            if (disabled || current.disabled || option.disabled) return;
                            close();
                            if (option.value !== value) onValueChange?.(option.value);
                          }}
                        >
                          <span className="min-w-0 break-words">{option.label}</span>
                          <Check
                            size={14}
                            aria-hidden="true"
                            className={option.value === value ? 'shrink-0' : 'invisible shrink-0'}
                          />
                        </Button>
                      ))
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        {emptyLabel ?? placeholder ?? rangeLabel}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid min-h-28 content-start gap-3 px-2 py-2">
                    <span className="break-words text-sm">{viewed?.label}</span>
                    {groupActionDescription && (
                      <p className="text-xs text-muted-foreground">{groupActionDescription}</p>
                    )}
                    {onGroupChange && viewed && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-auto min-h-8 justify-self-start whitespace-normal"
                        disabled={disabled || viewed.disabled}
                        onClick={() => {
                          if (disabled || viewed.disabled || viewed.value === groupValue) return;
                          close();
                          onGroupChange(viewed.value);
                        }}
                      >
                        {groupActionLabel ?? groupLabel}
                      </Button>
                    )}
                  </div>
                )}
              </section>
            </div>
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground break-words">{fullName}</p>
          </PopoverContent>
        </Popover>
      ) : (
        <div
          className={cn(
            'flex items-center rounded-[var(--control-radius)] border border-border bg-background text-foreground',
            triggerClass,
          )}
          title={fullName}
        >
          {body}
        </div>
      )}
    </div>
  );
}
