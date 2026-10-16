import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthenticationForm } from '@niubu/common-ui/auth';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot, usePlaygroundAuth } from './context';
import { resolvePlaygroundReturnTo } from './return-to';
import { appConfig } from '../app/config';

export function LoginForm({ expired = false }: { expired?: boolean }) {
  const auth = usePlaygroundAuth(),
    { t } = useTranslation('app'),
    location = useLocation();
  const [params] = useSearchParams();
  return (
    <AuthenticationForm
      mode="login"
      labels={{
        eyebrow: appConfig.displayName,
        heading: t('login'),
        description: t('loginDescription'),
        submit: t('login'),
        email: t('email'),
        password: t('password'),
        passwordPlaceholder: t('password'),
        emailError: t('emailError'),
        passwordError: t('passwordError'),
        submitError: t('loginError'),
        resultTitles: { 'not-submitted': t('loginError'), error: t('loginError'), success: t('loginSuccess') },
      }}
      onSubmit={async (values, signal) => {
        try {
          await auth.login(
            { username: values.email, password: values.password ?? '' },
            resolvePlaygroundReturnTo(
              expired ? `${location.pathname}${location.search}${location.hash}` : params.get('returnTo'),
            ),
            signal,
          );
          return { kind: 'success' };
        } catch {
          return { kind: 'error', message: t('loginError') };
        }
      }}
    />
  );
}
export function LoginPage() {
  const state = useAuthSnapshot();
  if (state.user && !state.loginExpired) return <Navigate replace to={appConfig.homeHref} />;
  return (
    <section className="playground-page">
      <LoginForm />
    </section>
  );
}
