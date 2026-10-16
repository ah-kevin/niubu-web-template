import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { ManagedDisplayPreferenceControls } from './ManagedDisplayPreferenceControls';

const identity = { storageNamespace: 'sample', product: 'sample', appId: 'sample-web', environment: 'local', identityKey: 'preview' };
it('keeps operation feedback local across extension writes and clears it on owner replacement', () => {
  const first = createPreferenceManager({ identity, storage: { read: () => ({ ok: true, value: null }), write: () => ({ ok: false, reason: 'denied' }) } });
  const second = createPreferenceManager({ identity: { ...identity, storageNamespace: 'other' }, storage: { read: () => ({ ok: true, value: null }), write: () => ({ ok: true }) }, appDefaults: { theme: { mode: 'light' }, density: 'compact' } });
  const extension = first.registerExtension({ namespace: 'sample.cards', version: 1, defaults: 0, validate: value => Number(value), migrate: () => 0 }, { scopeKey: 'opaque:a' });
  const scene = (owner: typeof first) => <PreferenceProvider manager={owner}><ManagedDisplayPreferenceControls /></PreferenceProvider>;
  const view = render(scene(first));
  fireEvent.click(screen.getByRole('radio', { name: '紧凑' }));
  expect(screen.getByRole('status')).toHaveTextContent('未保存');
  act(() => { extension.replace(1); });
  expect(screen.getByRole('status')).toHaveTextContent('未保存');
  view.rerender(scene(second));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '浅色' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '紧凑' })).toBeChecked();
  first.dispose(); second.dispose();
});
