import { useId, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { UserRound } from '@niubu/icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@niubu/shadcn-ui/dropdown-menu';
import type { WidgetLinkRenderer } from './types';

export type ShellAction = { disabled: boolean; reason?: string; onSelect(): void };
export type UserDropdownProps = {
  displayName: string;
  profile?: { href: string; renderLink: WidgetLinkRenderer; label?: string };
  trigger?: ReactElement;
  lock?: ShellAction;
  logout?: ShellAction;
  children?: ReactNode;
};
export function UserDropdown({ displayName, profile, trigger, lock, logout, children }: UserDropdownProps) {
  const { t } = useTranslation('shell');
  const reasonPrefix = useId();
  const ProfileLink = profile?.renderLink;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            className="max-[520px]:size-[var(--control-height)] max-[520px]:p-0"
            aria-label={t('user.menu')}
          >
            <span
              className="max-w-44 truncate max-[900px]:max-w-24 max-[700px]:max-w-16 max-[520px]:hidden"
              title={displayName}
            >
              {displayName}
            </span>
            <UserRound size={16} aria-hidden="true" className="hidden max-[520px]:block" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          className="foundation-tools-menu user-dropdown z-[70] max-h-[70vh] min-w-[220px] max-w-[calc(100vw_-_24px)] overflow-auto rounded-[var(--radius)] border border-border bg-card p-[8px] text-foreground shadow-[0_8px_24px_#0003]"
          align="end"
        >
          <p className="user-dropdown-name p-[8px] text-[.75rem] text-muted-foreground">{displayName}</p>
          {profile && ProfileLink && (
            <DropdownMenuItem
              className="flex cursor-pointer flex-col gap-[4px] rounded-[var(--radius)] px-[10px] py-[8px] no-underline outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:cursor-default data-[disabled]:opacity-60"
              asChild
            >
              <ProfileLink href={profile.href}>{profile.label ?? t('user.profile')}</ProfileLink>
            </DropdownMenuItem>
          )}
          {(['lock', 'logout'] as const).map(kind => {
            const action = kind === 'lock' ? lock : logout;
            if (!action) return null;
            const id = reasonPrefix + '-' + kind;
            return (
              <DropdownMenuItem
                className="flex cursor-pointer flex-col gap-[4px] rounded-[var(--radius)] px-[10px] py-[8px] no-underline outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:cursor-default data-[disabled]:opacity-60"
                key={kind}
                disabled={action.disabled}
                aria-label={t('user.' + kind)}
                aria-describedby={action.reason ? id : undefined}
                onSelect={() => {
                  if (!action.disabled) action.onSelect();
                }}
              >
                <span>{t('user.' + kind)}</span>
                {action.reason && (
                  <small className="text-muted-foreground whitespace-normal" id={id}>
                    {action.reason}
                  </small>
                )}
              </DropdownMenuItem>
            );
          })}
          {children}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
