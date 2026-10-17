import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { createAppStores } from '@niubu/stores';
import { StoresProvider } from '@niubu/stores/react';
import { NavigationGuard } from './NavigationGuard';

const loading = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
});
vi.mock('@niubu/common-ui/unsaved-guard', async () => {
  await loading.promise;
  return vi.importActual('@niubu/common-ui/unsaved-guard');
});

it('cancels the first lazy navigation confirmation without native scrolling or late focus restoration', async () => {
  const stores = createAppStores({ identityKey: 'fixture', readContext: { scope: { kind: 'region', id: 'one' }, businessDate: '2026-10-17', timeZone: 'UTC' } });
  stores.interaction.setDirty('editor', true);
  const router = createMemoryRouter([{ element: <><NavigationGuard /><Outlet /></>, children: [
    { path: '/', element: <><Link to="/next">Next page</Link><input aria-label="Current input" /></> },
    { path: '/next', element: <h1>Next</h1> },
  ] }], { initialEntries: ['/'] });
  const view = render(<StoresProvider stores={stores}><RouterProvider router={router} /></StoresProvider>);
  const trigger = screen.getByRole('link', { name: 'Next page' });
  trigger.focus();
  fireEvent.click(trigger);
  const focus = vi.spyOn(trigger, 'focus');
  try {
    expect(router.state.blockers.size).toBe(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(router.state.location.pathname).toBe('/');
    expect(trigger).toHaveFocus();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    const input = screen.getByRole('textbox', { name: 'Current input' });
    trigger.focus();
    fireEvent.click(trigger);
    input.focus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(router.state.location.pathname).toBe('/');
    expect(input).toHaveFocus();
    await act(async () => { loading.resolve(); await loading.promise; });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(input).toHaveFocus();
  } finally {
    focus.mockRestore();
    await act(async () => { loading.resolve(); await loading.promise; });
    view.unmount(); router.dispose(); stores.dispose();
  }
});
