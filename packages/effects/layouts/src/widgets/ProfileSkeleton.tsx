import type { ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Users } from '@niubu/icons';
export function ProfileSkeleton({ displayName, children }: { displayName: string; children?: ReactNode }) {
  const { t } = useTranslation('shell');
  return (
    <section className="profile-skeleton min-w-0 rounded-[var(--radius)] border border-border bg-card">
      <header className="border-b border-border p-[var(--workspace-card-padding)]">
        <h1 className="text-[length:var(--workspace-title-font-size)] font-[650]">{t('user.profile')}</h1>
      </header>
      <div className="flex flex-wrap items-center gap-4 p-[var(--workspace-card-padding)]">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--nav-active)] text-primary-text">
          <Users className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold [overflow-wrap:anywhere]">{displayName}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('user.profileNotConnected')}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
