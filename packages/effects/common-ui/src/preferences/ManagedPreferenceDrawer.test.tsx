import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { ManagedPreferenceDrawer } from './ManagedPreferenceDrawer';

const identity = { storageNamespace: 'sample', product: 'sample', appId: 'sample-web', environment: 'local', identityKey: 'preview' };
function manager(blocked = false) {
  const data = new Map<string, string>();
  return createPreferenceManager({ identity, storage: { read: key => ({ ok: true, value: data.get(key) ?? null }), write: (key, value) => { if (blocked) return { ok: false, reason: 'denied' }; data.set(key, value); return { ok: true }; } } });
}
it('provides local persistence feedback and keeps validated copy text when clipboard rejects', async () => {
  const owner = manager(true);
  render(<PreferenceProvider manager={owner}><ManagedPreferenceDrawer extensions={[]} configuration={() => [{ namespace: 'sample.cards', version: 1, value: { layout: 'wide', secret: 'private' }, validate: () => ({ layout: 'wide' }) }]} clipboard={{ writeText: async () => { throw Error('denied'); } }} onClose={() => {}} returnFocus={() => {}} /></PreferenceProvider>);
  fireEvent.click(screen.getByRole('radio', { name: '深色' }));
  expect(screen.getByRole('status')).toHaveTextContent('未保存');
  fireEvent.click(screen.getByRole('button', { name: '复制有效配置' }));
  const text = await screen.findByRole('textbox', { name: '可复制的有效配置' });
  expect(JSON.parse((text as HTMLTextAreaElement).value)).toMatchObject({ core: { theme: { mode: 'dark' } }, extensions: { 'sample.cards': { version: 1, value: { layout: 'wide' } } } });
  expect((text as HTMLTextAreaElement).value).not.toContain('private');
  owner.dispose();
});

it('drops feedback and late copy completion when the manager owner changes', async () => {
  const first = manager(true), second = manager();
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const scene = (owner: typeof first) => <PreferenceProvider manager={owner}><ManagedPreferenceDrawer extensions={[]} configuration={() => []} clipboard={{ writeText: () => pending }} onClose={() => {}} returnFocus={() => {}} /></PreferenceProvider>;
  const view = render(scene(first));
  fireEvent.click(screen.getByRole('radio', { name: '深色' }));
  fireEvent.click(screen.getByRole('button', { name: '复制有效配置' }));
  view.rerender(scene(second));
  await act(async () => { resolve(); await pending; });
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.getByRole('radio', { name: '跟随系统' })).toBeChecked();
  first.dispose(); second.dispose();
});
