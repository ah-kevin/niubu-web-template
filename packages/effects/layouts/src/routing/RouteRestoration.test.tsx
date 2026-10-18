import { useLayoutEffect, useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { createMemoryRouter, Link, RouterProvider, useLocation } from 'react-router-dom';
import { createPageIdentityResolver } from '@niubu/stores';
import type { ReadContext, RouteMeta } from '@niubu/core-typings';
import { RouteRestoration } from './RouteRestoration';
import { createRouteMatcher } from './registry';
import { usePageScrollCommit } from './context';
import { Notifications } from '../widgets/Notifications';
import { renderWidgets } from '../widgets/widget-test-utils';

const routers: ReturnType<typeof createMemoryRouter>[] = [];
afterEach(() => { routers.splice(0).forEach(router => router.dispose()); document.documentElement.scrollTop = 0; });

async function fixture() {
  const common = { scope: 'region', capability: null, titleKey: 'page', iconToken: 'File', order: 1, navigation: true } as const;
  const routes: readonly RouteMeta[] = [{ ...common, id: 'one', path: '/one' }, { ...common, id: 'two', path: '/two' }];
  const context: ReadContext = { scope: { kind: 'region', id: 'fixture' }, businessDate: '2026-10-18', timeZone: 'UTC' };
  const find = createRouteMatcher(routes, () => true);
  const identity = createPageIdentityResolver({ routes, findRoute: find, resolveScope: () => ({ allowed: true as const, scope: context.scope }), resolveUrlView: () => undefined, policies: {}, aliases: {}, needsReport: () => false, isPageRoute: () => true });
  const runtime = { resolveTab: identity.resolvePageTab, isContentRoute: () => true };
  let release!: () => void;
  function Content() {
    const location = useLocation(), commit = usePageScrollCommit();
    const [ready, setReady] = useState(false);
    useLayoutEffect(() => { release = () => setReady(true); }, []);
    useLayoutEffect(() => {
      if (ready) commit?.(identity.describePageLocation(location, context, null, { locationKey: location.key, commitToken: location.key }));
    }, [ready, location, commit]);
    return ready ? <h1>Page {location.pathname}</h1> : <p role="status">Content pending</p>;
  }
  function Scene() {
    const location = useLocation();
    return <RouteRestoration runtime={runtime}>
      <Link to="/two">Next page</Link>
      <Notifications sessionKey={location.key} items={[]} renderLink={props => <a {...props} />} />
      <label><span>Input label</span><input aria-label="Next input" /></label>
      <button aria-label="Next action"><svg><title>Focus icon</title></svg></button>
      <main id="main-content" tabIndex={-1}><Content key={location.key} /></main>
    </RouteRestoration>;
  }
  const router = createMemoryRouter([{ path: '*', element: <Scene /> }], { initialEntries: ['/one'] });
  routers.push(router);
  await renderWidgets(<RouterProvider router={router} />);
  await act(async () => { release(); });
  expect(screen.getByRole('main')).toHaveFocus();
  return { router, release: () => release(), commit: () => act(async () => { release(); }) };
}

it('focuses main for ordinary navigation even when its initiating link stays focused until content commits', async () => {
  const view = await fixture();
  const user = userEvent.setup();
  document.documentElement.scrollTop = 120;
  await user.click(screen.getByRole('link', { name: 'Next page' }));
  expect(screen.getByRole('link', { name: 'Next page' })).toHaveFocus();
  await view.commit();
  expect(screen.getByRole('main')).toHaveFocus();
  expect(document.documentElement.scrollTop).toBe(0);
});

it('does not mistake an old overlay automatic focus return for a newer user choice after navigation', async () => {
  const view = await fixture();
  await act(async () => { await view.router.navigate('/two'); });
  act(() => screen.getByRole('button', { name: 'Notifications' }).focus());
  await view.commit();
  expect(screen.getByRole('main')).toHaveFocus();
});

it('preserves a user input focus and selection chosen after navigation while destination content is pending', async () => {
  const view = await fixture();
  await act(async () => { await view.router.navigate('/two'); });
  const input = screen.getByRole('textbox', { name: 'Next input' }) as HTMLInputElement;
  await userEvent.setup().type(input, 'keep selection');
  input.setSelectionRange(2, 6);
  await view.commit();
  expect(input).toHaveFocus();
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
});

it.each(['label', 'icon'])('recognizes a post-navigation pointer target inside a focusable %s owner', async target => {
  const view = await fixture();
  await act(async () => { await view.router.navigate('/two'); });
  const owner = target === 'label' ? screen.getByRole('textbox', { name: 'Next input' }) : screen.getByRole('button', { name: 'Next action' });
  await userEvent.setup().click(target === 'label' ? screen.getByText('Input label') : screen.getByTitle('Focus icon'));
  expect(owner).toHaveFocus();
  await view.commit();
  expect(owner).toHaveFocus();
});

it('still focuses main when a newer interaction has left no connected focus owner', async () => {
  const view = await fixture();
  await act(async () => { await view.router.navigate('/two'); });
  const input = screen.getByRole('textbox', { name: 'Next input' });
  await userEvent.setup().click(input);
  act(() => input.blur());
  expect(document.body).toHaveFocus();
  await view.commit();
  expect(screen.getByRole('main')).toHaveFocus();
});

it('keeps a new active notification overlay focused when destination content commits', async () => {
  const view = await fixture();
  await act(async () => { await view.router.navigate('/two'); });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Notifications' }));
  const dialog = await screen.findByRole('dialog');
  const active = document.activeElement;
  await view.commit();
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).toBe(active);
});

it('restores Back scroll without stealing the notification launcher after reopen and Escape before a late commit', async () => {
  const view = await fixture(), user = userEvent.setup();
  document.documentElement.scrollTop = 110;
  await user.click(screen.getByRole('link', { name: 'Next page' }));
  await view.commit();
  document.documentElement.scrollTop = 220;
  await user.click(screen.getByRole('button', { name: 'Notifications' }));
  await screen.findByRole('dialog');
  await act(async () => { await view.router.navigate(-1); });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const trigger = screen.getByRole('button', { name: 'Notifications' });
  await user.click(trigger);
  await screen.findByRole('dialog');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
  await view.commit();
  expect(trigger).toHaveFocus();
  expect(document.documentElement.scrollTop).toBe(110);
  await act(async () => { await view.router.navigate(1); });
  await view.commit();
  expect(screen.getByRole('main')).toHaveFocus();
  expect(document.documentElement.scrollTop).toBe(220);
});

it('settles notification return focus when Escape and a late content commit share the closing batch', async () => {
  const view = await fixture(), user = userEvent.setup();
  await act(async () => { await view.router.navigate('/two'); });
  const trigger = screen.getByRole('button', { name: 'Notifications' });
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog');
  expect(dialog.contains(document.activeElement)).toBe(true);
  act(() => {
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    view.release();
  });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('dialog')).toBeNull();
});
