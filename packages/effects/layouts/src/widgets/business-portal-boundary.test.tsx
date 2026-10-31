import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@niubu/shadcn-ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@niubu/shadcn-ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogDescription } from '@niubu/shadcn-ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@niubu/shadcn-ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuTrigger } from '@niubu/shadcn-ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuTrigger } from '@niubu/shadcn-ui/context-menu';
import { Select } from '@niubu/shadcn-ui/select';
import { Tooltip } from '@niubu/shadcn-ui/tooltip';
import { BusinessPortalBoundary } from '@niubu/shadcn-ui/business-portal-boundary';
import { LocalLockBoundary } from './LocalLockBoundary';
import { createLocalLock } from '@niubu/hooks';
import { deferred } from './widget-test-utils';

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => vi.unstubAllGlobals());

const labels = { title: 'Lock', password: 'Password', unlock: 'Unlock', pending: 'Pending', invalid: 'Invalid', unavailable: 'Unavailable' };
function owner() {
  const values = new Map<string, string>();
  return createLocalLock({ identity: { storageNamespace: 'fixture', appId: 'app', environment: 'test', identityKey: 'user' }, storage: { read: key => ({ ok: true, value: values.get(key) ?? null }), write: (key, value) => { values.set(key, value); return { ok: true }; } }, crypto: { randomBytes: size => new Uint8Array(size), derive: async () => new Uint8Array(32) } });
}
function Modal({ onMount }: { onMount?: () => void }) {
  return <Dialog open><DialogContent onOpenAutoFocus={onMount}><DialogTitle>Late modal</DialogTitle><DialogDescription>Delayed response</DialogDescription><button>Late action</button></DialogContent></Dialog>;
}

it.each(['response', 'suspense'] as const)('RED2 holds actual late %s modal primitives outside commit until unlocked', async mode => {
  const lock = owner();
  const mounted = vi.fn();
  const gate = deferred<{ default: typeof Modal }>();
  const Lazy = lazy(() => gate.promise);
  const scene = (ready: boolean, current = true) => <LocalLockBoundary owner={lock} labels={labels}><Suspense fallback={<p>Waiting</p>}>{current && (mode === 'suspense' ? <Lazy onMount={mounted} /> : ready ? <Modal onMount={mounted} /> : null)}</Suspense></LocalLockBoundary>;
  const view = render(scene(false));
  await act(async () => { await lock.lock('fixture', new AbortController().signal); });
  if (mode === 'suspense') await act(async () => { gate.resolve({ default: Modal }); await gate.promise; });
  else view.rerender(scene(true));
  expect(document.querySelector('[data-slot="dialog-content"]')?.textContent).not.toContain('Late modal');
  expect(mounted).not.toHaveBeenCalled();
  const unlock = screen.getByRole('button', { name: 'Unlock' });
  expect(unlock.closest('[aria-hidden="true"], [inert]')).toBeNull();
  expect(unlock).not.toHaveStyle({ pointerEvents: 'none' });
  await act(async () => { await lock.unlock('fixture', new AbortController().signal); });
  expect(await screen.findByRole('dialog', { name: 'Late modal' })).toBeInTheDocument();
  expect(mounted).toHaveBeenCalledTimes(1);
  view.unmount(); lock.dispose();
});

it('does not latch a committed Portal or Suspense fallback as actual content admission and discards retired leases', async () => {
  const gate = deferred<{ default: () => ReactNode }>();
  const mounted = vi.fn();
  const Lazy = lazy(() => gate.promise);
  const scene = (locked: boolean, current: boolean) => <BusinessPortalBoundary locked={locked}><Dialog open><DialogPortal><Suspense fallback={<p>Portal fallback</p>}>{current && <Lazy />}</Suspense></DialogPortal></Dialog></BusinessPortalBoundary>;
  const view = render(scene(false, true));
  view.rerender(scene(true, true));
  await act(async () => { gate.resolve({ default: () => <DialogContent onOpenAutoFocus={mounted}><DialogTitle>Lazy content</DialogTitle><DialogDescription>Resolved later</DialogDescription></DialogContent> }); await gate.promise; });
  expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
  expect(mounted).not.toHaveBeenCalled();
  view.rerender(scene(true, false));
  view.rerender(scene(false, false));
  expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
});

it.each(['dialog', 'sheet', 'alert', 'popover', 'dropdown', 'context'] as const)('RED4 holds %s content and pins explicit portals to a stable business host in StrictMode', async kind => {
  const escaped = document.createElement('div'); document.body.append(escaped);
  let content: ReactNode;
  switch (kind) {
    case 'dialog': content = <Dialog open><DialogPortal container={escaped}><DialogContent><DialogTitle>Pinned</DialogTitle><DialogDescription>Fixture</DialogDescription></DialogContent></DialogPortal></Dialog>; break;
    case 'sheet': content = <Sheet open><SheetContent><SheetTitle>Pinned</SheetTitle><SheetDescription>Fixture</SheetDescription></SheetContent></Sheet>; break;
    case 'alert': content = <AlertDialog open><AlertDialogContent><AlertDialogTitle>Pinned</AlertDialogTitle><AlertDialogDescription>Fixture</AlertDialogDescription><button>OK</button></AlertDialogContent></AlertDialog>; break;
    case 'popover': content = <Popover open><PopoverTrigger>Trigger</PopoverTrigger><PopoverContent>Pinned</PopoverContent></Popover>; break;
    case 'dropdown': content = <DropdownMenu open><DropdownMenuTrigger>Trigger</DropdownMenuTrigger><DropdownMenuPortal container={escaped}><DropdownMenuContent><DropdownMenuItem>Pinned</DropdownMenuItem></DropdownMenuContent></DropdownMenuPortal></DropdownMenu>; break;
    case 'context': content = <ContextMenu><ContextMenuTrigger>Trigger</ContextMenuTrigger><ContextMenuPortal container={escaped}><ContextMenuContent><ContextMenuItem>Pinned</ContextMenuItem></ContextMenuContent></ContextMenuPortal></ContextMenu>; break;
  }
  const scene = (locked: boolean) => <StrictMode><BusinessPortalBoundary locked={locked}>{content}</BusinessPortalBoundary></StrictMode>;
  const view = render(scene(true));
  if (kind === 'context') fireEvent.contextMenu(screen.getByText('Trigger'), { clientX: 10, clientY: 10 });
  expect(escaped.textContent).toBe('');
  expect(screen.queryByText('Pinned')).toBeNull();
  view.rerender(scene(false));
  const pinned = await screen.findByText('Pinned');
  const host = pinned.closest('[data-business-portal-host]');
  expect(host).not.toBeNull();
  expect(host!.parentElement).toHaveAttribute('data-business-root');
  view.rerender(scene(true));
  expect(pinned).toBeInTheDocument();
  expect(pinned.closest('[data-business-portal-host]')).toBe(host);
  expect(pinned.closest('[inert]')).not.toBeNull();
  view.unmount(); escaped.remove();
});

it('ordinary portals keep their explicit container outside a boundary', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const view = render(<Dialog open><DialogPortal container={container}><div>Explicit ordinary portal</div></DialogPortal></Dialog>);
  expect(await screen.findByText('Explicit ordinary portal')).toHaveProperty('parentElement', container);
  view.unmount(); container.remove();
});

it('RED4 retires barrier listeners and suppresses pending Escape without replacing the overlay stack', async () => {
  const module = await import('@niubu/shadcn-ui/overlay-ownership');
  const barrier = module.registerInteractionBarrier;
  const allowed = document.createElement('button'); const business = document.createElement('button');
  document.body.append(allowed, business);
  const cancel = vi.fn(), late = vi.fn();
  const pending = module.registerPendingOverlay(window, cancel);
  const unregister = barrier(window, { kind: 'lock', element: allowed, focusFallback: () => allowed });
  window.addEventListener('keydown', late);
  fireEvent.keyDown(business, { key: 'Escape' });
  expect(cancel).not.toHaveBeenCalled();
  expect(late).not.toHaveBeenCalled();
  unregister(); unregister();
  fireEvent.keyDown(business, { key: 'Escape' });
  expect(cancel).toHaveBeenCalledTimes(1);
  pending(); window.removeEventListener('keydown', late); allowed.remove(); business.remove();
});

it('does not count a closed inline Content wrapper as a committed menu presence', async () => {
  const scene = (locked: boolean, open: boolean) => <BusinessPortalBoundary locked={locked}><DropdownMenu open={open}><DropdownMenuTrigger>Inline trigger</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>New inline presence</DropdownMenuItem></DropdownMenuContent></DropdownMenu></BusinessPortalBoundary>;
  const view = render(scene(false, false));
  expect(screen.queryByText('New inline presence')).toBeNull();
  view.rerender(scene(true, true));
  expect(screen.queryByText('New inline presence')).toBeNull();
  view.rerender(scene(false, true));
  expect(await screen.findByText('New inline presence')).toBeInTheDocument();
  view.rerender(scene(false, false));
  view.rerender(scene(true, true));
  expect(screen.queryByText('New inline presence')).toBeNull();
});

it('keeps host/container stable from first Content commit without a temporary body placement', async () => {
  const parents: (HTMLElement | null)[] = [];
  const commit = (node: HTMLDivElement | null) => { if (node) parents.push(node.parentElement?.closest<HTMLElement>('[data-business-portal-host]') ?? null); };
  const scene = (locked: boolean) => <StrictMode><BusinessPortalBoundary locked={locked}><Dialog open><DialogContent ref={commit}><DialogTitle>First commit</DialogTitle><DialogDescription>Host ready</DialogDescription></DialogContent></Dialog></BusinessPortalBoundary></StrictMode>;
  const view = render(scene(false));
  const original = screen.getByRole('dialog', { name: 'First commit' });
  const host = original.closest('[data-business-portal-host]');
  expect(host).not.toBeNull();
  expect(parents.length).toBeGreaterThan(0);
  expect(new Set(parents)).toEqual(new Set([host]));
  view.rerender(scene(true)); view.rerender(scene(false));
  expect(screen.getByRole('dialog', { name: 'First commit' })).toBe(original);
  expect(new Set(parents)).toEqual(new Set([host]));
  view.unmount();
});

it('uses reauth priority, native container fallback and idempotent cleanup without late focus restoration', async () => {
  const { registerInteractionBarrier, registerPendingOverlay } = await import('@niubu/shadcn-ui/overlay-ownership');
  const business = document.createElement('button');
  const lock = document.createElement('div'); lock.tabIndex = -1;
  const reauth = document.createElement('div'); reauth.tabIndex = -1;
  document.body.append(business, lock, reauth);
  const cancel = vi.fn();
  const pending = registerPendingOverlay(window, cancel);
  const unlock = registerInteractionBarrier(window, { kind: 'lock', element: lock, focusFallback: () => lock });
  const authenticated = registerInteractionBarrier(window, { kind: 'reauth', element: reauth, focusFallback: () => reauth });
  business.focus(); expect(reauth).toHaveFocus();
  lock.focus(); expect(reauth).toHaveFocus();
  fireEvent.keyDown(reauth, { key: 'Escape' }); expect(cancel).not.toHaveBeenCalled();
  authenticated(); authenticated();
  await act(async () => { await Promise.resolve(); });
  expect(lock).toHaveFocus();
  const again = registerInteractionBarrier(window, { kind: 'reauth', element: reauth, focusFallback: () => reauth });
  again(); unlock(); pending();
  business.focus();
  await act(async () => { await Promise.resolve(); });
  expect(business).toHaveFocus();
  business.remove(); lock.remove(); reauth.remove();
});

it.each(['dialog', 'alert'] as const)('gates an explicitly exported %s Overlay before its primitive can mount', kind => {
  const content = kind === 'dialog' ? <Dialog open><DialogPortal><DialogOverlay /></DialogPortal></Dialog> : <AlertDialog open><AlertDialogPortal><AlertDialogOverlay /></AlertDialogPortal></AlertDialog>;
  const view = render(<BusinessPortalBoundary locked>{content}</BusinessPortalBoundary>);
  expect(document.querySelector('[data-slot$="dialog-overlay"]')).toBeNull();
  view.rerender(<BusinessPortalBoundary locked={false}>{content}</BusinessPortalBoundary>);
  expect(document.querySelector('[data-slot$="dialog-overlay"]')?.closest('[data-business-portal-host]')).not.toBeNull();
});

it.each(['select', 'tooltip'] as const)('holds late %s content and uses the fixed host on unlock', async kind => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} });
  try {
    const content = kind === 'select' ? <Select label="Selection" value="one" onValueChange={() => {}} options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }]} /> : <Tooltip content="Pinned tip"><button>Tip trigger</button></Tooltip>;
    const scene = (locked: boolean) => <BusinessPortalBoundary locked={locked}>{content}</BusinessPortalBoundary>;
    const view = render(scene(true));
    if (kind === 'select') fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    else act(() => { screen.getByRole('button', { name: 'Tip trigger' }).focus(); });
    expect(screen.queryByRole(kind === 'select' ? 'listbox' : 'tooltip')).toBeNull();
    view.rerender(scene(false));
    const primitive = await screen.findByRole(kind === 'select' ? 'listbox' : 'tooltip');
    expect(primitive.closest('[data-business-portal-host]')).not.toBeNull();
    view.unmount();
  } finally {
    vi.unstubAllGlobals();
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
});

it('retains the original single keydown listener for pending owners and adds barrier events only during a barrier', async () => {
  const { registerPendingOverlay, registerInteractionBarrier } = await import('@niubu/shadcn-ui/overlay-ownership');
  const target = new EventTarget();
  const add = vi.spyOn(target, 'addEventListener');
  const remove = vi.spyOn(target, 'removeEventListener');
  const one = registerPendingOverlay(target, () => {});
  const two = registerPendingOverlay(target, () => {});
  expect(add).toHaveBeenCalledTimes(1);
  const element = document.createElement('button'); document.body.append(element);
  const barrier = registerInteractionBarrier(target, { kind: 'lock', element, focusFallback: () => element });
  expect(add).toHaveBeenCalledTimes(5);
  barrier(); barrier();
  expect(remove).toHaveBeenCalledTimes(4);
  one(); two();
  expect(remove).toHaveBeenCalledTimes(5);
  element.remove();
});
