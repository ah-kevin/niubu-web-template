import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthenticationForm } from '@niubu/common-ui/auth';
import { LoginLayout } from './LoginLayout';
import { useLoginText } from './copy';
import { useAuthSnapshot, usePlaygroundAuth } from './context';
import { resolvePlaygroundReturnTo } from './return-to';
import { appConfig } from '../app/config';

export function LoginForm({ expired = false }: { expired?: boolean }) {
  const auth = usePlaygroundAuth(),
    t = useLoginText(),
    location = useLocation();
  const [params] = useSearchParams();
  return (
    <div className="template-auth" data-expired={expired}>
      <AuthenticationForm
        mode="login"
        labels={{
          eyebrow: null,
          heading: expired ? t('login') : t('login.welcome'),
          description: null,
          submit: t('login'),
          email: t('login.account'),
          emailPlaceholder: t('login.accountPlaceholder'),
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
            return { kind: 'error' };
          }
        }}
      />
    </div>
  );
}
export function LoginPage() {
  const state = useAuthSnapshot();
  if (state.user && !state.loginExpired) return <Navigate replace to={appConfig.homeHref} />;
  return (
    <LoginLayout>
      <LoginForm />
    </LoginLayout>
  );
}
