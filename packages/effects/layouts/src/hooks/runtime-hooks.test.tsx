import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFullscreen } from './useFullscreen';
import { useOverlaySession } from './useOverlaySession';
import { useShellShortcuts } from './useShellShortcuts';

afterEach(() => vi.unstubAllGlobals());
it('invalidates stale close and focus callbacks after an overlay is reopened', () => {
  let latest!: ReturnType<typeof useOverlaySession>;
  function Scene() { latest = useOverlaySession('stable'); return <button onClick={event => latest.openOverlay(event.currentTarget)}>Open</button>; }
  render(<Scene />);
  fireEvent.click(screen.getByRole('button'));
  const stale = latest;
  act(() => latest.close());
  fireEvent.click(screen.getByRole('button'));
  act(() => { stale.close(); stale.returnFocus(); });
  expect(latest.open).toBe(true);
});
it('invalidates stale open callbacks after a session change', () => {
  let latest!: ReturnType<typeof useOverlaySession>;
  function Scene({ session }: { session: string }) { latest = useOverlaySession(session); return null; }
  const view = render(<Scene session="one" />);
  const stale = latest;
  view.rerender(<Scene session="two" />);
  act(() => stale.openOverlay());
  expect(latest.open).toBe(false);
  act(() => latest.openOverlay());
  expect(latest.open).toBe(true);
});
it('uses the existing fullscreen engine and removes its listeners on StrictMode disposal', async () => {
  const add = vi.spyOn(document, 'addEventListener');
  const remove = vi.spyOn(document, 'removeEventListener');
  let active: Element | null = null;
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });
  const request = vi.fn(async () => { active = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); });
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: request });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: async () => { active = null; document.dispatchEvent(new Event('fullscreenchange')); } });
  function Scene() { const { snapshot, toggle } = useFullscreen(); return <button aria-pressed={snapshot.active} onClick={() => void toggle()}>Fullscreen {snapshot.status}</button>; }
  const view = render(<StrictMode><Scene /></StrictMode>);
  await act(async () => { fireEvent.click(screen.getByRole('button')); });
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByRole('button')); });
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  view.unmount();
  for (const event of ['fullscreenchange', 'fullscreenerror']) {
    const installed = add.mock.calls.filter(call => call[0] === event).map(call => call[1]);
    const removed = remove.mock.calls.filter(call => call[0] === event).map(call => call[1]);
    expect(installed.length).toBeGreaterThan(0);
    expect(removed).toEqual(installed);
  }
  delete (document as unknown as Record<string, unknown>).fullscreenEnabled;
  delete (document as unknown as Record<string, unknown>).fullscreenElement;
  delete (document as unknown as Record<string, unknown>).exitFullscreen;
  delete (document.documentElement as unknown as Record<string, unknown>).requestFullscreen;
});
it('keeps the latest shortcut callback and removes its listener on disposal', () => {
  function Scene({ title }: { title: string }) { const [count, setCount] = useState(0); useShellShortcuts({ search: () => { document.title = title; setCount(value => value + 1); } }); return <><input aria-label="Editor" /><output aria-label="Dispatches">{count}</output></>; }
  const original = document.title;
  const view = render(<StrictMode><Scene title="first" /></StrictMode>);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(document.title).toBe('first');
  expect(screen.getByLabelText('Dispatches')).toHaveTextContent('1');
  view.rerender(<StrictMode><Scene title="second" /></StrictMode>);
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'k', ctrlKey: true });
  expect(document.title).toBe('first');
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(document.title).toBe('second');
  expect(screen.getByLabelText('Dispatches')).toHaveTextContent('2');
  view.unmount();
  document.title = 'disposed';
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(document.title).toBe('disposed');
  document.title = original;
});
