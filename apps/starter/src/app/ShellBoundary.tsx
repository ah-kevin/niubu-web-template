import type { ReactNode } from 'react';
import { LocalLockBoundary } from '@niubu/layouts/widgets';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot } from '../auth/context';
import { ExpiredLogin } from '../auth/Expired';
import type { StarterShellRuntime } from './shell-context';
export function ShellBoundary({ runtime, children }: { runtime: StarterShellRuntime | null; children: ReactNode }) {
  const state = useAuthSnapshot(),
    { t } = useTranslation('shell');
  if (!runtime) return <>{children}</>;
  if (!runtime.lock)
    return (
      <>
        {children}
        <ExpiredLogin />
      </>
    );
  return (
    <LocalLockBoundary
      owner={runtime.lock}
      labels={{
        title: t('lock.title'),
        password: t('lock.password'),
        unlock: t('lock.unlock'),
        pending: t('lock.pending'),
        invalid: t('lock.invalid'),
        unavailable: t('lock.unavailable'),
      }}
      reauthentication={{ active: state.loginExpired, content: <ExpiredLogin /> }}
    >
      {children}
    </LocalLockBoundary>
  );
}
