// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as access from './react';

afterEach(cleanup);

it('requires an explicit provider', () => {
  function Consumer() { access.useAccess(); return null; }
  expect(() => render(<Consumer />)).toThrow(/AccessProvider/);
});
it('updates real native button disabled state when readiness or codes change', () => {
  const clicked = vi.fn();
  const content = <access.AccessControl codes={['write']} strategy="disable">
    {({ disabled, allowed }) => <button disabled={disabled} onClick={clicked}>{allowed ? 'Write' : 'Blocked'}</button>}
  </access.AccessControl>;
  const view = render(<access.AccessProvider value={{ codes: ['write'], roles: [], ready: false }}>{content}</access.AccessProvider>);
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button'));
  expect(clicked).not.toHaveBeenCalled();
  view.rerender(<access.AccessProvider value={{ codes: ['write'], roles: [], ready: true }}>{content}</access.AccessProvider>);
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button'));
  expect(clicked).toHaveBeenCalledOnce();
  view.rerender(<access.AccessProvider value={{ codes: [], roles: [], ready: true }}>{content}</access.AccessProvider>);
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
});
it('hides denied content with fallback and requires both codes and roles', () => {
  const view = render(<access.AccessProvider value={{ codes: ['read'], roles: ['member'], ready: true }}>
    <access.AccessControl codes={['read', 'write']} roles={['admin', 'member']} fallback={<p>Denied</p>}><button>Write</button></access.AccessControl>
  </access.AccessProvider>);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Denied')).toBeTruthy();
  view.rerender(<access.AccessProvider value={{ codes: ['read', 'write'], roles: ['member'], ready: true }}>
    <access.AccessControl codes={['read', 'write']} roles={['admin', 'member']} fallback={<p>Denied</p>}><button>Write</button></access.AccessControl>
  </access.AccessProvider>);
  expect(screen.getByRole('button').textContent).toBe('Write');
});
it('supports any/all matching and denies even empty requirements until ready', () => {
  function Consumer() {
    const { hasCodes, hasRoles, ready } = access.useAccess();
    return <output>{JSON.stringify([ready, hasCodes(['read', 'write']), hasCodes(['read', 'write'], 'any'),
      hasRoles(['admin', 'member']), hasRoles(['admin', 'member'], 'all'), hasCodes([]), hasRoles([])])}</output>;
  }
  const view = render(<access.AccessProvider value={{ codes: ['read'], roles: ['member'], ready: true }}><Consumer /></access.AccessProvider>);
  expect(screen.getByRole('status').textContent).toBe('[true,false,true,true,false,true,true]');
  view.rerender(<access.AccessProvider value={{ codes: ['read'], roles: ['member'], ready: false }}><Consumer /></access.AccessProvider>);
  expect(screen.getByRole('status').textContent).toBe('[false,false,false,false,false,false,false]');
});
it('rejects disable strategy without a render function instead of faking disabled classes', () => {
  expect(() => render(<access.AccessProvider value={{ codes: [], roles: [], ready: true }}>
    {/* @ts-expect-error disable requires a render function */}
    <access.AccessControl strategy="disable"><button>Unsafe</button></access.AccessControl>
  </access.AccessProvider>)).toThrow(/render function/i);
});
