import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { OverlayFocusSettlementContext } from '../routing/context';
import { useOverlaySession } from './useOverlaySession';

function fixture(strict = false) {
  const releases: ReturnType<typeof vi.fn>[] = [];
  const begin = vi.fn(() => { const release = vi.fn(); releases.push(release); return release; });
  let current!: ReturnType<typeof useOverlaySession>;
  function Probe({ owner }: { owner: string }) {
    current = useOverlaySession(owner);
    return <><button aria-controls="fixture-overlay">Launcher</button><input aria-label="New owner" />{current.open && <div id="fixture-overlay" role="dialog" data-state="open"><input aria-label="Overlay input" /></div>}</>;
  }
  const scene = (owner: string) => <OverlayFocusSettlementContext value={begin}><Probe owner={owner} /></OverlayFocusSettlementContext>;
  const wrap = (owner: string) => strict ? <StrictMode>{scene(owner)}</StrictMode> : scene(owner);
  const view = render(wrap('one'));
  const trigger = screen.getByRole('button', { name: 'Launcher' });
  const open = () => { act(() => { trigger.focus(); current.openOverlay(trigger); }); act(() => screen.getByLabelText('Overlay input').focus()); };
  return { begin, releases, trigger, open, session: () => current, rerender: (owner: string) => view.rerender(wrap(owner)), unmount: view.unmount };
}

it('reserves once for a real close and keeps the handoff through an immediate returnFocus call until unmount settles', () => {
  const f = fixture();
  act(() => f.session().close());
  expect(f.begin).not.toHaveBeenCalled();
  f.open();
  const closing = f.session();
  act(() => { closing.close(); closing.close(); closing.returnFocus(); });
  expect(f.begin).toHaveBeenCalledTimes(1);
  expect(f.releases[0]).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => closing.returnFocus());
  expect(f.trigger).toHaveFocus();
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
  act(() => { closing.close(); closing.returnFocus(); });
  expect(f.begin).toHaveBeenCalledTimes(1);
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
});

it('releases a close handoff when a newer focus owner wins without reclaiming it', () => {
  const f = fixture(); f.open();
  const closing = f.session();
  act(() => closing.close());
  const input = screen.getByLabelText('New owner');
  act(() => { input.focus(); closing.returnFocus(); });
  expect(input).toHaveFocus();
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
});

it('cancels a pending return with close(false) without reserving again through a stale close callback', () => {
  const f = fixture(); f.open();
  const closing = f.session();
  act(() => closing.close());
  act(() => { closing.close(false); closing.close(); closing.returnFocus(); });
  expect(f.begin).toHaveBeenCalledTimes(1);
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
});

it('retires an old epoch while its delayed callback cannot clear the next return handoff', () => {
  const f = fixture(); f.open();
  const old = f.session();
  act(() => old.close());
  f.open();
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
  const next = f.session();
  act(() => next.close());
  act(() => old.returnFocus());
  expect(f.releases[1]).not.toHaveBeenCalled();
  act(() => next.returnFocus());
  expect(f.releases[1]).toHaveBeenCalledTimes(1);
  expect(f.trigger).toHaveFocus();
});

it('releases invalidated context ownership without reserving for an automatic route dismissal', () => {
  const f = fixture(); f.open();
  f.rerender('two');
  expect(f.begin).not.toHaveBeenCalled();
  f.open();
  const old = f.session();
  act(() => old.close());
  f.rerender('three');
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
  act(() => old.returnFocus());
  expect(f.begin).toHaveBeenCalledTimes(1);
});

it('cleans a pending return exactly once on StrictMode unmount and rejects its old callback', () => {
  const f = fixture(true); f.open();
  const closing = f.session();
  act(() => closing.close());
  f.unmount();
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
  closing.returnFocus();
  expect(f.releases[0]).toHaveBeenCalledTimes(1);
});
