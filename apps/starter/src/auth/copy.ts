import { useTranslation } from '@niubu/locales/react';

export const loginCopyZh = {
  'login.welcome': '欢迎回来',
  'login.account': '账号',
  'login.accountPlaceholder': 'admin 或 viewer',
  login: '登录',
  password: '密码',
  emailError: '请输入账号。',
  passwordError: '请输入密码。',
  loginError: '登录失败，请检查账号后重试。',
  loginSuccess: '登录成功',
} as const;
export const loginCopyEn: Record<keyof typeof loginCopyZh, string> = {
  'login.welcome': 'Welcome back',
  'login.account': 'Account',
  'login.accountPlaceholder': 'admin or viewer',
  login: 'Sign in',
  password: 'Password',
  emailError: 'Enter an account.',
  passwordError: 'Enter a password.',
  loginError: 'Sign-in failed. Check your account and retry.',
  loginSuccess: 'Signed in',
};

export function useLoginText() {
  const { t, locale } = useTranslation('app', loginCopyZh);
  const fallback = locale === 'en-US' ? loginCopyEn : loginCopyZh;
  return (key: keyof typeof loginCopyZh) => {
    const result = t(key);
    return result === key || result === `app:${key}` ? fallback[key] : result;
  };
}
