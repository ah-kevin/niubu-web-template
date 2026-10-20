import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthenticationForm } from '@niubu/common-ui/auth';
import { LoginLayout } from './LoginLayout';
import { useLoginText } from './copy';
import { useAuthSnapshot, useStarterAuth } from './context';
import { resolveStarterReturnTo } from './return-to';
import { appConfig } from '../app/config';

export function LoginForm({ expired = false }: { expired?: boolean }) {
  const auth = useStarterAuth(),
    t = useLoginText(),
    location = useLocation();
  const [params] = useSearchParams();
  return (
    <div
      className="template-auth w-full min-w-0 max-w-[380px] [&_.auth-card]:w-full [&_.auth-card>h1]:mb-[32px] [&_.auth-card>h1]:text-[30px] [&_.auth-card>h1]:leading-snug [&_.auth-card>h1]:tracking-tight data-[expired=true]:max-w-none data-[expired=true]:[&_.auth-card>h1]:mb-[24px] data-[expired=true]:[&_.auth-card>h1]:text-[24px] [@media(max-width:800px)]:[&_.auth-card>h1]:text-[28px]"
      data-expired={expired}
    >
      <AuthenticationForm
        mode="login"
        loginIdentifier="username"
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
              resolveStarterReturnTo(
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
