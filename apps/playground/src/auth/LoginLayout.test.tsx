import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AuthenticationForm } from '@niubu/common-ui/auth';
import { LoginLayout } from './LoginLayout';

it('applies local form sizing over the existing public/auth styles without changing unrelated forms', () => {
  const sheet = document.createElement('style');
  sheet.textContent = [
    readFileSync(resolve(import.meta.dirname, '../../../../packages/@core/ui-kit/layout-ui/src/styles.css'), 'utf8'),
    readFileSync(resolve(import.meta.dirname, '../../../../packages/effects/common-ui/src/auth/styles.css'), 'utf8'),
    readFileSync(resolve(import.meta.dirname, 'login.css'), 'utf8'),
  ].join('\n');
  document.head.append(sheet);
  const labels = { eyebrow: null, heading: 'Welcome back', description: null, submit: 'Sign in', email: 'Account', password: 'Password', passwordPlaceholder: 'Password', emailError: 'Required', passwordError: 'Required', submitError: 'Failed', resultTitles: { error: 'Failed', success: 'Done', 'not-submitted': 'Not submitted' } };
  try {
    const view = render(<><LoginLayout><div className="template-auth"><AuthenticationForm mode="login" labels={labels} onSubmit={async () => ({ kind: 'success' })} /></div></LoginLayout><div aria-label="other form"><AuthenticationForm mode="login" labels={{ ...labels, heading: 'Other' }} onSubmit={async () => ({ kind: 'success' })} /></div></>);
    const main = screen.getByRole('main');
    expect(getComputedStyle(main.querySelector('.template-auth')!).maxWidth).toBe('380px');
    expect(getComputedStyle(main.querySelector('input')!).height).toBe('46px');
    expect(getComputedStyle(main.querySelector('input')!).fontSize).toBe('14px');
    expect(getComputedStyle(main.querySelector('h1')!).fontSize).toBe('30px');
    expect(getComputedStyle(main.querySelector('button')!).justifyContent).toBe('center');
    const other = screen.getByLabelText('other form');
    expect(getComputedStyle(other.querySelector('input')!).fontSize).toBe('12px');
    expect(getComputedStyle(other.querySelector('input')!).height).toBe('44px');
    expect(view.container.querySelector('.template-login-art')).toHaveAttribute('aria-hidden', 'true');
  } finally { sheet.remove(); }
});
