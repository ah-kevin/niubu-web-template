import type { ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
export function ProfileSkeleton({ displayName, children }: { displayName: string; children?: ReactNode }) {
  const { t } = useTranslation('shell');
  return (
    <section className="profile-skeleton max-w-[64rem] p-[1.5rem]">
      <h1 className="mb-[1rem] text-[1.5rem] font-semibold">{t('user.profile')}</h1>
      <p className="my-[.75rem]">{displayName}</p>
      <p className="my-[.75rem]">{t('user.profileNotConnected')}</p>
      {children}
    </section>
  );
}
