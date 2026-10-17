import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { createAuthSession } from '@niubu/stores';
import { I18nProvider } from '@niubu/locales/react';
import { AuthenticationForm } from '@niubu/common-ui/auth';
import { createPlaygroundI18n } from '../locales';
import { PlaygroundAuthProvider } from '../auth/provider';
import { LoginPage } from '../auth/Login';
import type { LoginInput, PlaygroundUser } from '../auth/schemas';

export async function renderLoginStyleScene() {
  const auth = createAuthSession<PlaygroundUser, LoginInput>({
    adapter: {
      restore: async () => null,
      login: async () => {
        throw new Error('No authentication in style checks');
      },
      logout: async () => {},
      refresh: async () => {},
      getCodes: async () => [],
      getMenu: async () => [],
      credentialsProvider: () => ({ credentials: 'omit' }),
      invalidateLocal() {},
    },
    onIdentityReset() {},
    onScopeReset() {},
    reload() {},
    homeHref: '/home',
    loginHref: '/login',
  });
  await auth.restore();
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  const view = render(
    <MemoryRouter initialEntries={['/login']}>
      <I18nProvider instance={i18n}>
        <PlaygroundAuthProvider auth={auth}>
          <LoginPage />
          <div aria-label="other form">
            <AuthenticationForm
              mode="login"
              labels={{
                eyebrow: null,
                heading: 'Other',
                description: null,
                submit: 'Other submit',
                email: 'Other account',
                password: 'Other password',
                passwordPlaceholder: 'Password',
                emailError: 'Required',
                passwordError: 'Required',
                submitError: 'Failed',
                resultTitles: { error: 'Failed', success: 'Done', 'not-submitted': 'Pending' },
              }}
              onSubmit={async () => ({ kind: 'not-submitted' })}
            />
          </div>
        </PlaygroundAuthProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  return {
    view,
    dispose() {
      view.unmount();
      auth.dispose();
      i18n.dispose();
    },
  };
}
