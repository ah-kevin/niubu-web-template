import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as preferences from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import { PreferencesPage } from './PreferencesPage';

afterEach(() => vi.restoreAllMocks());

it('updates and resets the real extension reactively without touching ambient preferences or browser storage', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const ambient = preferences.createPreferenceManager({
    identity: { product: 'ambient', storageNamespace: 'ambient', appId: 'ambient', environment: 'test', identityKey: 'real-user' },
    storage: createStoragePort({ getItem: () => null, setItem() {} }),
  });
  const before = ambient.getSnapshot();
  const view = render(<preferences.PreferenceProvider manager={ambient}><PreferencesPage /></preferences.PreferenceProvider>);
  expect(await screen.findByText('业务视图：balanced / 摘要：显示')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '应用宽屏预设' }));
  expect(screen.getByText('业务视图：wide / 摘要：隐藏')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示业务摘要' }));
  expect(screen.getByText('业务视图：wide / 摘要：显示')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重置业务扩展' }));
  expect(screen.getByText('业务视图：balanced / 摘要：显示')).toBeInTheDocument();
  expect(ambient.getSnapshot()).toBe(before);
  expect(storage).not.toHaveBeenCalled();
  view.unmount(); ambient.dispose();
});

it('disposes all synthetic preference managers across strict replay and starts fresh on remount', async () => {
  const original = preferences.createPreferenceManager;
  const owners: preferences.PreferenceManager[] = [];
  const disposals: ReturnType<typeof vi.spyOn>[] = [];
  vi.spyOn(preferences, 'createPreferenceManager').mockImplementation(options => {
    const manager = original(options);
    owners.push(manager); disposals.push(vi.spyOn(manager, 'dispose'));
    return manager;
  });
  const first = render(<StrictMode><PreferencesPage /></StrictMode>);
  fireEvent.click(await screen.findByRole('button', { name: '应用宽屏预设' }));
  first.unmount();
  expect(owners.length).toBeGreaterThanOrEqual(2);
  disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  const next = render(<PreferencesPage />);
  expect(await screen.findByText('业务视图：balanced / 摘要：显示')).toBeInTheDocument();
  next.unmount();
  disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
});
