import { createElement, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { createRoutes } from './routes';
import { RouteRestoration } from './RouteRestoration';

it('composes the owned outlet beside persistent root siblings without key warnings or remounting them on navigation', async () => {
  function PersistentGuard() {
    const [value, setValue] = useState('');
    return <input aria-label="Persistent root input" value={value} onChange={event => setValue(event.target.value)} />;
  }
  const errors = vi.spyOn(console, 'error');
  const runtime = { resolveTab: () => null, isContentRoute: () => false };
  const router = createMemoryRouter(createRoutes({
    routes: [{ path: '/one' }, { path: '/two' }],
    loaders: {},
    homeHref: '/one',
    renderFrame: ({ path }) => <main id="main-content" tabIndex={-1}><h1>{path === '/one' ? 'Page one' : 'Page two'}</h1></main>,
    renderRoot: outlet => createElement(RouteRestoration, { runtime, children: [createElement(PersistentGuard, { key: 'guard' }), outlet] }),
  }), { initialEntries: ['/one'] });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<RouterProvider router={router} />); });
  try {
    await screen.findByRole('heading', { name: 'Page one' });
    const guard = screen.getByRole('textbox', { name: 'Persistent root input' });
    fireEvent.change(guard, { target: { value: 'keep the current owner' } });
    await act(async () => { await router.navigate('/two'); });
    await screen.findByRole('heading', { name: 'Page two' });
    expect(screen.getByRole('textbox', { name: 'Persistent root input' })).toBe(guard);
    expect(guard).toHaveValue('keep the current owner');
    expect(router.state.location.pathname).toBe('/two');
    expect(errors.mock.calls.filter(args => args.some(value => typeof value === 'string' && value.includes('Each child in a list should have a unique')))).toEqual([]);
  } finally {
    view.unmount();
    router.dispose();
    errors.mockRestore();
  }
});
