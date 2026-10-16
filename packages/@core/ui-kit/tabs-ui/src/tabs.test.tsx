import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabBar, type TabBarProps } from './TabBar';
const labels = { navigation: 'Pages', close: 'Close', pin: 'Pin', unpin: 'Unpin', refresh: 'Refresh', maximize: 'Maximize', restore: 'Restore', newWindow: 'New window', left: 'Close left', right: 'Close right', other: 'Close other', all: 'Close all', more: 'More', previous: 'Previous', next: 'Next', overflow: 'Over capacity' };
const fixture = (props: Partial<TabBarProps> = {}) => ({ tabs: [{ key: 'home', label: 'Home', pinned: true, closable: false }, { key: 'a', label: 'A', pinned: false, closable: true }, { key: 'b', label: 'B', pinned: false, closable: true }], activeKey: 'a', labels, draggable: true, wheelable: true, middleClickClose: true, showMore: true, showMaximize: true, showRefresh: true, showIcon: true, style: 'brisk' as const, maximized: false, onActivate: vi.fn(), onClose: vi.fn(), onReorder: vi.fn(), onCommand: vi.fn(), ...props });
describe('controlled page tab view', () => {
  it('requests activation and close without optimistic state and protects home/middle-click settings', async () => {
    const p = fixture(); render(<TabBar {...p} />); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(p.onActivate).toHaveBeenCalledWith('b'); expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-current', 'page');
    fireEvent(screen.getByRole('button', { name: 'B' }), new MouseEvent('auxclick', { button: 1, bubbles: true })); expect(p.onClose).toHaveBeenCalledWith('b');
    fireEvent(screen.getByRole('button', { name: 'Home' }), new MouseEvent('auxclick', { button: 1, bubbles: true })); expect(p.onClose).toHaveBeenCalledTimes(1);
  });
  it('uses the same pin-segment constraint for keyboard and drag ordering', () => {
    const p = fixture(); render(<TabBar {...p} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'A' }), { key: 'ArrowLeft', altKey: true, shiftKey: true }); expect(p.onReorder).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'A' }), { key: 'ArrowRight', altKey: true, shiftKey: true }); expect(p.onReorder).toHaveBeenCalledWith(['home', 'b', 'a']);
  });
  it('provides real context and more commands with keyboard dismissal and focus return', async () => {
    const p = fixture(); render(<TabBar {...p} />); const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'B' }));
    await user.click(screen.getByRole('menuitem', { name: 'Pin' })); expect(p.onCommand).toHaveBeenCalledWith('pin', 'b');
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Close other' })); expect(p.onCommand).toHaveBeenCalledWith('other', 'a');
    await user.click(screen.getByRole('button', { name: 'More' })); await user.keyboard('{Escape}'); expect(screen.queryByRole('menu')).toBeNull(); expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  });
  it('consumes wheel only when enabled and requests actual refresh/maximize', async () => {
    const p = fixture(); const v = render(<TabBar {...p} />); const region = screen.getByTestId('page-tab-scroll');
    Object.defineProperty(region, 'scrollWidth', { configurable: true, value: 900 }); Object.defineProperty(region, 'clientWidth', { configurable: true, value: 300 });
    fireEvent.wheel(region, { deltaY: 40 }); expect(region.scrollLeft).toBe(40);
    v.rerender(<TabBar {...p} wheelable={false} />); fireEvent.wheel(region, { deltaY: 40 }); expect(region.scrollLeft).toBe(40);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' })); await userEvent.click(screen.getByRole('button', { name: 'Maximize' })); expect(vi.mocked(p.onCommand).mock.calls).toEqual([['refresh', 'a'], ['maximize', 'a']]);
  });
});
it('reveals only the horizontal tab scroller without scrolling document ancestors on rerenders', () => {
  const reveal = vi.fn(); const previous = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = reveal;
  const p = fixture(); const v = render(<TabBar {...p} />);
  const region = screen.getByTestId('page-tab-scroll');
  const active = screen.getByRole('button', { name: 'A' });
  Object.defineProperty(region, 'clientWidth', { configurable: true, value: 100 });
  Object.defineProperty(active.parentElement, 'offsetLeft', { configurable: true, value: 150 });
  Object.defineProperty(active.parentElement, 'offsetWidth', { configurable: true, value: 80 });
  v.rerender(<TabBar {...p} tabs={[...p.tabs]} />);
  expect(region.scrollLeft).toBe(130); expect(reveal).not.toHaveBeenCalled();
  HTMLElement.prototype.scrollIntoView = previous;
});
