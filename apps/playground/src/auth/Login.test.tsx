import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { createAuthSession } from '@niubu/stores';
import { createI18n } from '@niubu/locales';
import { I18nProvider } from '@niubu/locales/react';
import { LoginForm, LoginPage } from './Login';
import { PlaygroundAuthProvider } from './provider';
import type { LoginInput, PlaygroundUser } from './schemas';

const disposers: (() => void)[] = [];
afterEach(() => disposers.splice(0).reverse().forEach(dispose => dispose()));
const user: PlaygroundUser = { id: 'synthetic-reader', name: 'Synthetic Reader', roles: [], workspaces: [{ kind: 'workspace', id: 'north' }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function Location() {
  const location = useLocation();
  return <output aria-label="route">{location.pathname}</output>;
}
async function mount({ expired = false, formOnly = false, href = '/login?returnTo=%2Fhome', english = false }: { expired?: boolean; formOnly?: boolean; href?: string; english?: boolean } = {}) {
  const login = vi.fn(async (_input: LoginInput, _op: { signal: AbortSignal; assertCurrent(): void }) => user);
  const reload = vi.fn();
  const identityReset = vi.fn();
  const auth = createAuthSession<PlaygroundUser, LoginInput>({
    adapter: { restore: async () => expired ? user : null, login, logout: async () => {}, refresh: async () => {}, getCodes: async () => ['demo:read'], getMenu: async () => [], credentialsProvider: () => ({ credentials: 'omit' }), invalidateLocal() {} },
    onIdentityReset: identityReset, onScopeReset() {}, reload, homeHref: '/home', loginHref: '/login',
  });
  await auth.restore();
  if (expired) { await auth.switchScope({ kind: 'workspace', id: 'north' }); auth.markLoginExpired(); }
  // Deliberately omit app keys: the installed provider must not suppress the app-local fallback.
  const i18n = createI18n({ defaultLocale: 'zh-CN', domTarget: { lang: 'zh-CN', dir: 'ltr' }, appLoaders: { app: { fallback: {}, load: async () => ({}) } } });
  if (english) await i18n.changeLocale('en-US', i18n.requiredNamespaces);
  const tree = (child: ReactNode) => <MemoryRouter initialEntries={[href]}><I18nProvider instance={i18n}><PlaygroundAuthProvider auth={auth}>{child}<Location /></PlaygroundAuthProvider></I18nProvider></MemoryRouter>;
  const view = render(tree(formOnly || expired ? <LoginForm expired={expired} /> : <LoginPage />));
  disposers.push(() => { view.unmount(); auth.dispose(); i18n.dispose(); });
  return { view, auth, login, reload, identityReset, i18n };
}
function fill() {
  fireEvent.change(screen.getByLabelText('账号'), { target: { value: 'synthetic@example.invalid' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'synthetic-only' } });
}

describe('independent minimal login', () => {
  it('owns one main landmark and a product link, with only account/password and submit', async () => {
    const { view } = await mount();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: 'Template Playground' })).toHaveAttribute('href', '/home');
    expect(within(main).getByRole('heading', { name: '欢迎回来' })).toBeVisible();
    expect(within(main).getAllByRole('button')).toHaveLength(1);
    expect(within(main).getByRole('button', { name: '登录' })).toBeEnabled();
    const fields = main.querySelectorAll('input');
    expect(fields).toHaveLength(2);
    expect(screen.getByLabelText('账号')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('密码')).toHaveAttribute('type', 'password');
    expect(main.querySelector('form')).toBeVisible();
    expect(main.querySelector('form')?.closest('.template-auth')).not.toBeNull();
    expect(view.container.querySelector('.playground-page, .foundation-layout')).toBeNull();
    expect(within(main).queryByRole('link')).toBeNull();
  });

  it('uses English fallback under a provider before app locale integration', async () => {
    await mount({ english: true });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.getByLabelText('Account')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('focuses the first invalid field, submits through the auth owner, and reports failure', async () => {
    const f = await mount();
    f.login.mockRejectedValueOnce(new Error('synthetic rejection'));
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(screen.getByLabelText('账号')).toHaveFocus();
    expect(screen.getByLabelText('账号')).toHaveAttribute('aria-invalid', 'true');
    expect(f.login).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('账号'), { target: { value: 'synthetic@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(screen.getByLabelText('密码')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'synthetic-only' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('登录失败，请检查账号后重试。');
    expect(f.reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '登录' })).toBeEnabled();
  });

  it('editing pending credentials cancels the owner operation and ignores late success', async () => {
    const f = await mount();
    const pending = deferred<PlaygroundUser>();
    f.login.mockImplementationOnce(() => pending.promise);
    fill();
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(f.login).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: '登录' })).toBeDisabled();
    expect(f.login.mock.calls[0][0]).toEqual({ username: 'synthetic@example.invalid', password: 'synthetic-only' });
    const signal = f.login.mock.calls[0][1].signal;
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'changed-synthetic' } });
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(user));
    expect(f.reload).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: '登录' })).toBeEnabled();
  });

  it('unmount cancels pending authentication without a late redirect', async () => {
    const f = await mount();
    const pending = deferred<PlaygroundUser>();
    f.login.mockImplementationOnce(() => pending.promise);
    fill();
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(f.login).toHaveBeenCalledOnce());
    const signal = f.login.mock.calls[0][1].signal;
    f.view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(user));
    expect(f.reload).not.toHaveBeenCalled();
  });

  it.each([
    ['/login?returnTo=%2Fhome%3FscopeKind%3Dworkspace%26scopeId%3Dnorth%23section', '/home?scopeKind=workspace&scopeId=north#section'],
    ['/login?returnTo=https%3A%2F%2Foutside.invalid', '/home'],
  ])('preserves the validated return target for %s', async (href, target) => {
    const f = await mount({ href });
    fill();
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(f.reload).toHaveBeenCalledWith(target));
  });

  it('expired form stays embeddable and resumes the same person and scope without a page reload', async () => {
    const f = await mount({ expired: true, href: '/home?scopeKind=workspace&scopeId=north#section' });
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(f.view.container.querySelector('.template-login-layout')).toBeNull();
    expect(f.view.container.querySelector('form')?.closest('.template-auth')).not.toBeNull();
    fill();
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(f.auth.getSnapshot()).toMatchObject({ status: 'ready', loginExpired: false, user: { id: 'synthetic-reader' }, scope: { kind: 'workspace', id: 'north' }, codes: ['demo:read'] }));
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.identityReset).not.toHaveBeenCalled();
    expect(screen.getByLabelText('route')).toHaveTextContent('/home');
  });
});
