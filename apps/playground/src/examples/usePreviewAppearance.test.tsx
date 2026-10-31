import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createStoragePort } from '@niubu/hooks';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { ControlGallery } from './components/ControlGallery';

it('inherits global settings by default and keeps configured colors and radius in explicit previews', () => {
  const data = new Map<string, string>();
  const manager = createPreferenceManager({
    identity: {
      product: 'preview-test',
      appId: 'preview-test',
      environment: 'test',
      storageNamespace: 'preview-test',
      identityKey: 'test',
    },
    storage: createStoragePort({
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
      },
    }),
    appDefaults: { theme: { preset: 'custom', colorPrimary: '#8b5cf6', radius: 1, mode: 'dark' }, density: 'compact' },
  });
  const view = render(
    <PreferenceProvider manager={manager}>
      <ControlGallery only="Button" />
    </PreferenceProvider>,
  );
  try {
    const gallery = view.container.querySelector('[data-control-gallery]') as HTMLElement;
    expect(gallery).not.toHaveAttribute('data-theme');
    expect(gallery).not.toHaveAttribute('data-density');
    expect(gallery.style.getPropertyValue('--primary')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(gallery.style.getPropertyValue('--primary')).toBe('#8b5cf6');
    expect(gallery.style.getPropertyValue('--control-radius')).toBe('16px');
    act(() => {
      manager.update({ theme: { colorPrimary: '#e11d48', radius: 0.25 } });
    });
    expect(gallery.style.getPropertyValue('--primary')).toBe('#e11d48');
    expect(gallery.style.getPropertyValue('--control-radius')).toBe('4px');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Preview theme' })).getByRole('button', { name: 'Follow global' }),
    );
    expect(gallery.style.getPropertyValue('--primary')).toBe('');
    expect(gallery).not.toHaveAttribute('data-theme');
  } finally {
    view.unmount();
    manager.dispose();
  }
});
