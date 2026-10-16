import { useId, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
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
          <Button type="button" variant="ghost" aria-label={t('user.menu')}>
            {displayName}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent className="foundation-tools-menu user-dropdown" align="end">
          <p className="user-dropdown-name">{displayName}</p>
          {profile && ProfileLink && (
            <DropdownMenuItem asChild>
              <ProfileLink href={profile.href}>{profile.label ?? t('user.profile')}</ProfileLink>
            </DropdownMenuItem>
          )}
          {(['lock', 'logout'] as const).map(kind => {
            const action = kind === 'lock' ? lock : logout;
            if (!action) return null;
            const id = reasonPrefix + '-' + kind;
            return (
              <DropdownMenuItem
                key={kind}
                disabled={action.disabled}
                aria-label={t('user.' + kind)}
                aria-describedby={action.reason ? id : undefined}
                onSelect={() => {
                  if (!action.disabled) action.onSelect();
                }}
              >
                <span>{t('user.' + kind)}</span>
                {action.reason && <small id={id}>{action.reason}</small>}
              </DropdownMenuItem>
            );
          })}
          {children}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
