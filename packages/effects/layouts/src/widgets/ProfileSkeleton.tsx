import type { ReactNode } from 'react';
import { useTranslation } from '@niubu/locales/react';
export function ProfileSkeleton({ displayName, children }: { displayName: string; children?: ReactNode }) {
  const { t } = useTranslation('shell');
  return (
    <section className="profile-skeleton">
      <h1>{t('user.profile')}</h1>
      <p>{displayName}</p>
      <p>{t('user.profileNotConnected')}</p>
      {children}
    </section>
  );
}
