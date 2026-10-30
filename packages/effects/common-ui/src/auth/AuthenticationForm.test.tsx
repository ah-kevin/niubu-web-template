import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationForm, type AuthenticationFormProps, type AuthenticationResult } from './AuthenticationForm';

const labels: AuthenticationFormProps['labels'] = {
  eyebrow: 'Entry', heading: 'Enter workspace', description: 'Use your account',
  submit: 'Continue', email: 'Email', password: 'Password', passwordPlaceholder: 'Password',
  emailError: 'Valid email required', passwordError: 'Password required', submitError: 'Unable to continue',
  resultTitles: { 'not-submitted': 'Not submitted', error: 'Failed', success: 'Complete' },
};
const base: AuthenticationFormProps = { mode: 'login', labels, onSubmit: async () => ({ kind: 'not-submitted' }) };
function fill() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' reader@example.invalid ' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: ' example password ' } });
}
function deferred() {
  let resolve!: (value: AuthenticationResult) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<AuthenticationResult>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
describe('AuthenticationForm', () => {
  it.each(['login', 'recover', 'invite'] as const)('uses username identifiers only for explicit login, retaining email validation for %s', async mode => {
    const submit = vi.fn(async () => ({ kind: 'success' as const }));
    render(<AuthenticationForm {...base} mode={mode} loginIdentifier="username" onSubmit={submit} />);
    const account = screen.getByLabelText('Email');
    fireEvent.change(account, { target: { value: 'admin' } });
    if (mode === 'login') fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    if (mode === 'login') {
      expect(await screen.findByRole('status')).toHaveTextContent('Complete');
      expect(submit).toHaveBeenCalledWith({ email: 'admin', password: 'admin' }, expect.any(AbortSignal));
      expect(account).toHaveAttribute('type', 'text');
      expect(account).toHaveAttribute('autocomplete', 'username');
    } else {
      expect(submit).not.toHaveBeenCalled();
      expect(account).toHaveAttribute('type', 'email');
      expect(account).toHaveAccessibleDescription('Valid email required');
    }
  });
  it('uses shared input and label controls while retaining browser autofill and validation focus', () => {
    render(<AuthenticationForm {...base} fieldIds={{ email: 'shared-email', password: 'shared-password' }} />);
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('data-slot', 'input');
    expect(password).toHaveAttribute('data-slot', 'input');
    expect(document.querySelector('label[for="shared-email"]')).toHaveAttribute('data-slot', 'label');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription('Valid email required');
  });
  it('uses caller field identifiers for labels and validation descriptions', () => {
    render(<AuthenticationForm {...base} fieldIds={{ email: 'existing-email', password: 'existing-password' }} />);
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('id', 'existing-email');
    expect(password).toHaveAttribute('id', 'existing-password');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(email).toHaveAttribute('aria-describedby', 'existing-email-error');
    expect(password).toHaveAttribute('aria-describedby', 'existing-password-error');
    expect(email).toHaveAccessibleDescription('Valid email required');
    expect(password).toHaveAccessibleDescription('Password required');
  });
  it('validates fields and focuses the first invalid field before submitting', async () => {
    const submit = vi.fn((values: Parameters<AuthenticationFormProps['onSubmit']>[0]) => base.onSubmit(values));
    render(<AuthenticationForm {...base} onSubmit={values => submit(values)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Valid email required');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password required');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: ' example password ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Not submitted');
    expect(submit).toHaveBeenCalledExactlyOnceWith({ email: 'reader@example.invalid', password: ' example password ' });
  });
  it.each(['resolved', 'rejected'] as const)('shows %s async failures and allows retry', async kind => {
    const submit = vi.fn(async (): Promise<AuthenticationResult> => {
      if (kind === 'rejected') throw Error('private transport details');
      return { kind: 'error', message: 'Try again later' };
    });
    render(<AuthenticationForm {...base} onSubmit={submit} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent(kind === 'rejected' ? 'Unable to continue' : 'Try again later');
    expect(screen.queryByText('private transport details')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
  it('ignores a late result after unmount and cannot contaminate a fresh form', async () => {
    const late = deferred();
    const view = render(<AuthenticationForm {...base} onSubmit={() => late.promise} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    view.unmount();
    render(<AuthenticationForm {...base} />);
    const focusTarget = screen.getByLabelText('Email');
    focusTarget.focus();
    await act(async () => late.resolve({ kind: 'error', message: 'Late failure' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(focusTarget).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
  it('does not apply pending results after input changes or mode changes', async () => {
    const late = deferred();
    const props = { ...base, onSubmit: () => late.promise };
    const view = render(<AuthenticationForm {...props} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'other@example.invalid' } });
    await act(async () => late.resolve({ kind: 'success', message: 'Old account' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.rerender(<AuthenticationForm {...props} mode="recover" />);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });
  it.each(['recover', 'invite'] as const)('submits %s email without a password and renders injected links', async mode => {
    const submit = vi.fn((values: Parameters<AuthenticationFormProps['onSubmit']>[0]) => base.onSubmit(values));
    render(<AuthenticationForm {...base} mode={mode} onSubmit={values => submit(values)}
      links={{ back: { href: '/entry?next=%2Fsample', label: 'Return' } }}
      renderLink={({ href, children, className }) => <a href={href} className={className}>{children}</a>} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Not submitted');
    expect(submit).toHaveBeenCalledExactlyOnceWith({ email: 'reader@example.invalid' });
    expect(screen.getByRole('link', { name: 'Return' })).toHaveAttribute('href', '/entry?next=%2Fsample');
  });
});


describe('AuthenticationForm cancellation', () => {
  it.each([
    { field: 'Email', value: 'changed@example.invalid', completion: 'resolved' },
    { field: 'Email', value: 'changed@example.invalid', completion: 'rejected' },
    { field: 'Password', value: 'changed example password', completion: 'resolved' },
    { field: 'Password', value: 'changed example password', completion: 'rejected' },
  ] as const)('aborts on $field edits and ignores the obsolete $completion completion', async ({ field, value, completion }) => {
    const late = deferred();
    let providedSignal: AbortSignal | undefined;
    render(<AuthenticationForm {...base} onSubmit={(_values: unknown, signal?: AbortSignal) => {
      providedSignal = signal;
      signal?.addEventListener('abort', () => {
        if (completion === 'rejected') late.reject(new DOMException('Cancelled', 'AbortError'));
      }, { once: true });
      return late.promise;
    }} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(providedSignal).toBeInstanceOf(AbortSignal);
    expect(providedSignal?.aborted).toBe(false);
    expect(screen.getByLabelText(field)).toBeEnabled();
    await act(async () => {
      fireEvent.change(screen.getByLabelText(field), { target: { value } });
    });
    expect(providedSignal?.aborted).toBe(true);
    if (completion === 'resolved') {
      await act(async () => late.resolve({ kind: 'success', message: 'Obsolete result' }));
    }
    expect(screen.getByLabelText(field)).toHaveValue(value);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it.each(['unmount', 'recover', 'invite'] as const)('aborts a pending submit on %s', async transition => {
    const late = deferred();
    let providedSignal: AbortSignal | undefined;
    const onSubmit = (_values: unknown, signal?: AbortSignal) => {
      providedSignal = signal;
      signal?.addEventListener('abort', () => late.reject(new DOMException('Cancelled', 'AbortError')), { once: true });
      return late.promise;
    };
    const view = render(<AuthenticationForm {...base} onSubmit={onSubmit} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(providedSignal).toBeInstanceOf(AbortSignal);
    expect(providedSignal?.aborted).toBe(false);
    await act(async () => {
      if (transition === 'unmount') view.unmount();
      else view.rerender(<AuthenticationForm {...base} mode={transition} onSubmit={onSubmit} />);
    });
    expect(providedSignal?.aborted).toBe(true);
    if (transition === 'unmount') render(<AuthenticationForm {...base} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it.each([
    ['resolved', 'old-first'], ['rejected', 'old-first'],
    ['resolved', 'new-first'], ['rejected', 'new-first'],
  ] as const)('cancels the previous submit without stale commits or UI (%s, %s)', async (completion, order) => {
    const requests = [deferred(), deferred()];
    const signals: Array<AbortSignal | undefined> = [];
    const commits: number[] = [];
    render(<AuthenticationForm {...base} onSubmit={async (_values: unknown, signal?: AbortSignal) => {
      const index = signals.length;
      signals.push(signal);
      const response = await requests[index]!.promise;
      if (!signal?.aborted) commits.push(index);
      return response;
    }} />);
    fill();
    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(button);
    const form = button.closest('form')!;
    fireEvent.submit(form);
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]).toBeInstanceOf(AbortSignal);
    expect(signals[1]?.aborted).toBe(false);
    expect(signals[1]).not.toBe(signals[0]);
    const settleOld = () => act(async () => {
      if (completion === 'rejected') requests[0]!.reject(new DOMException('Cancelled', 'AbortError'));
      else requests[0]!.resolve({ kind: 'success', message: 'Obsolete result' });
    });
    if (order === 'old-first') {
      await settleOld();
      expect(button).toBeDisabled();
      expect(form).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    }
    await act(async () => requests[1]!.resolve({ kind: 'success', message: 'Current result' }));
    if (order === 'new-first') await settleOld();
    expect(commits).toEqual([1]);
    expect(screen.getByRole('status')).toHaveTextContent('Current result');
    expect(screen.queryByText('Obsolete result')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(form).toHaveAttribute('aria-busy', 'false');
  });
});


it('uses explicit initial values without overwriting later edits on rerender', async () => {
 const submit=vi.fn(async()=>({kind:'success' as const}));
 const view=render(<AuthenticationForm {...base} defaultValues={{email:'demo@example.invalid',password:'synthetic'}} onSubmit={submit}/>);
 expect(screen.getByLabelText('Email')).toHaveValue('demo@example.invalid');
 expect(screen.getByLabelText('Password')).toHaveValue('synthetic');
 fill();view.rerender(<AuthenticationForm {...base} defaultValues={{email:'other@example.invalid',password:'other'}} onSubmit={submit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(await screen.findByRole('status')).toHaveTextContent('Complete');
 expect(submit).toHaveBeenCalledWith({email:'reader@example.invalid',password:' example password '},expect.any(AbortSignal));
});
