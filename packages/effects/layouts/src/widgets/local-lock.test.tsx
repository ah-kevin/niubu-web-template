import { useEffect, type ReactNode } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useSchemaForm } from '@niubu/common-ui/form';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@niubu/shadcn-ui/dialog';
import { createLocalLock } from '@niubu/hooks';
import { LocalLockBoundary, type LockLabels } from './LocalLockBoundary';
import { renderWidgets } from './widget-test-utils';

const labels: LockLabels = { title: 'Local interface lock', password: 'Lock password', unlock: 'Unlock', pending: 'Checking', invalid: 'Incorrect password', unavailable: 'Lock unavailable' };
function makeLock() {
  const values = new Map<string, string>();
  return createLocalLock({
    identity: { storageNamespace: 'fixture', appId: 'demo', environment: 'test', identityKey: 'user' },
    storage: { read: key => ({ ok: true, value: values.get(key) ?? null }), write: (key, value) => { values.set(key, value); return { ok: true }; } },
    crypto: { randomBytes: size => new Uint8Array(size).fill(1), derive: async password => new Uint8Array(32).fill(password === 'synthetic' ? 1 : 2) },
  });
}
function assertReachable(element: HTMLElement) {
  expect(element.closest('[aria-hidden="true"], [inert]')).toBeNull();
  expect(element).not.toHaveStyle({ pointerEvents: 'none' });
}
const nextFrame = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

it('RED1 preserves actual RHF owner, dirty input and DOM through modal → lock → single reauth → lock → unlock', async () => {
  const owner = makeLock();
  const mounts = vi.fn();
  const owners: unknown[] = [];
  function DirtyModal() {
    const form = useSchemaForm<{ note: string }>({ fields: [{ name: 'note', kind: 'text', label: 'Dirty note' }], defaultValues: { note: '' } });
    useEffect(() => { mounts(); owners.push(form.form); }, [form.form]);
    return <Dialog open><DialogContent><DialogTitle>Editing</DialogTitle><DialogDescription>Unsaved record</DialogDescription><form.Form showActions={false} /><output>{form.form.formState.isDirty ? 'dirty' : 'clean'}</output></DialogContent></Dialog>;
  }
  function Reauth() {
    return <Dialog open><DialogContent showCloseButton={false}><DialogTitle>Sign in again</DialogTitle><DialogDescription>Same user</DialogDescription><button>Reauthenticate</button></DialogContent></Dialog>;
  }
  const scene = (active: boolean) => <LocalLockBoundary owner={owner} labels={labels} reauthentication={{ active, content: <Reauth /> }}><DirtyModal /></LocalLockBoundary>;
  const view = await renderWidgets(scene(false));
  const user = userEvent.setup();
  const original = screen.getByRole('textbox', { name: 'Dirty note' });
  await user.type(original, 'unsaved text');
  await act(async () => { await owner.lock('synthetic', new AbortController().signal); });
  const unlock = await screen.findByRole('button', { name: 'Unlock' });
  assertReachable(unlock);
  expect(original).toBeInTheDocument();
  expect(original.closest('[inert]')).not.toBeNull();
  await user.keyboard('{Escape}');
  expect(owner.getSnapshot().locked).toBe(true);
  view.rerender(scene(true));
  const reauth = await screen.findByRole('button', { name: 'Reauthenticate' });
  assertReachable(reauth);
  expect(screen.queryByRole('button', { name: 'Unlock' })).toBeNull();
  await user.click(reauth);
  await user.tab(); expect(reauth).toHaveFocus();
  await user.tab({ shift: true }); expect(reauth).toHaveFocus();
  view.rerender(scene(false));
  await nextFrame();
  const password = screen.getByLabelText('Lock password');
  assertReachable(password);
  expect(password).toHaveValue('');
  await user.type(password, 'synthetic');
  await user.click(screen.getByRole('button', { name: 'Unlock' }));
  await waitFor(() => expect(owner.getSnapshot().locked).toBe(false));
  await nextFrame();
  expect(screen.getByRole('textbox', { name: 'Dirty note' })).toBe(original);
  expect(original).toHaveValue('unsaved text');
  expect(screen.getByText('dirty')).toBeInTheDocument();
  expect(mounts).toHaveBeenCalledTimes(1);
  expect(new Set(owners).size).toBe(1);
  expect(original.closest('[inert]')).toBeNull();
  view.unmount(); owner.dispose();
});

it('restored locked state admits no initial business modal and clears submitted passwords even on failure', async () => {
  const owner = makeLock();
  await owner.lock('synthetic', new AbortController().signal);
  const mounted = vi.fn();
  const view = await renderWidgets(<LocalLockBoundary owner={owner} labels={labels}><Dialog open><DialogContent onOpenAutoFocus={mounted}><DialogTitle>Blocked initial</DialogTitle><DialogDescription>Blocked</DialogDescription></DialogContent></Dialog></LocalLockBoundary>);
  expect(document.querySelector('[data-slot="dialog-content"]')?.textContent).not.toContain('Blocked initial');
  expect(mounted).not.toHaveBeenCalled();
  const input = screen.getByLabelText('Lock password');
  fireEvent.change(input, { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  await screen.findByRole('alert');
  expect(input).toHaveValue('');
  expect(owner.getSnapshot().locked).toBe(true);
  assertReachable(input);
  view.unmount(); owner.dispose();
});

it('RED3 blocks business DOM/portal input, programmatic focus and window shortcut dispatch while allowing native lock Tab', async () => {
  const owner = makeLock();
  const action = vi.fn();
  const shortcut = vi.fn();
  const scene = <LocalLockBoundary owner={owner} labels={labels}><button onClick={action} onKeyDown={action}>Business action</button><Dialog open><DialogContent><DialogTitle>Old modal</DialogTitle><DialogDescription>Keep mounted</DialogDescription><button onClick={action}>Portal action</button></DialogContent></Dialog></LocalLockBoundary>;
  const view = await renderWidgets(scene);
  const business = screen.getByText('Business action');
  const portal = screen.getByRole('button', { name: 'Portal action' });
  await act(async () => { await owner.lock('synthetic', new AbortController().signal); });
  window.addEventListener('keydown', shortcut);
  const user = userEvent.setup();
  const unlock = screen.getByRole('button', { name: 'Unlock' });
  unlock.focus();
  for (const key of ['k', ',']) for (const modifier of ['ctrlKey', 'metaKey']) fireEvent.keyDown(unlock, { key, [modifier]: true });
  for (const target of [business, portal]) {
    fireEvent.keyDown(target, { key: 'Enter' });
    fireEvent.pointerDown(target);
    fireEvent.click(target);
    target.focus();
    expect(target).not.toHaveFocus();
  }
  expect(action).not.toHaveBeenCalled();
  expect(shortcut).not.toHaveBeenCalled();
  expect(portal).toBeInTheDocument();
  const password = screen.getByLabelText('Lock password');
  password.focus();
  await user.tab(); expect(unlock).toHaveFocus();
  await user.tab(); expect(password).toHaveFocus();
  await user.tab({ shift: true }); expect(unlock).toHaveFocus();
  window.removeEventListener('keydown', shortcut);
  view.unmount(); owner.dispose();
});

it('keeps reauthentication usable without a local lock', async () => {
  const owner = makeLock();
  const content: ReactNode = <Dialog open><DialogContent><DialogTitle>Only reauth</DialogTitle><DialogDescription>Auth expired</DialogDescription><button>Sign in</button></DialogContent></Dialog>;
  const view = await renderWidgets(<LocalLockBoundary owner={owner} labels={labels} reauthentication={{ active: true, content }}><button>Business</button></LocalLockBoundary>);
  assertReachable(await screen.findByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('button', { name: 'Business', hidden: true }).closest('[inert]')).not.toBeNull();
  view.unmount(); owner.dispose();
});
