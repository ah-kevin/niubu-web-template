import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPendingOverlay } from '@niubu/shadcn-ui/overlay-ownership';
import { TabBar, type TabBarProps } from './TabBar';

const labels = { navigation: 'Pages', close: 'Close', pin: 'Pin', unpin: 'Unpin', refresh: 'Refresh', maximize: 'Maximize', restore: 'Restore', newWindow: 'New window', left: 'Close left', right: 'Close right', other: 'Close other', all: 'Close all', more: 'More', previous: 'Previous', next: 'Next', overflow: 'Over capacity' };
function renderTabs() {
  const props: TabBarProps = { tabs: [{ key: 'home', label: 'Home', pinned: true, closable: false }, { key: 'a', label: 'A', pinned: false, closable: true }], activeKey: 'a', labels, draggable: false, wheelable: true, middleClickClose: true, showMore: true, showMaximize: false, showRefresh: false, showIcon: false, style: 'chrome', maximized: false, onActivate: vi.fn(), onClose: vi.fn(), onReorder: vi.fn(), onCommand: vi.fn() };
  render(<div style={{ overflow: 'hidden', transform: 'translateX(0)' }}><TabBar {...props} /></div>);
  return props;
}
function rect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) };
}

beforeEach(() => {
  vi.stubGlobal('innerWidth', 978);
  vi.stubGlobal('innerHeight', 953);
  // jsdom has no layout: supply measured menu, tab and button dimensions only.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('role') === 'menu') return rect(0, 0, 200, 288);
    if (this.getAttribute('aria-label') === 'More') return rect(930, 48, 32, 40);
    return rect(110, 48, 120, 40);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('tab menu anchors', () => {
  it('opens a portaled menu at the right-click pointer and restores the clicked tab focus', () => {
    renderTabs();
    const tab = screen.getByRole('button', { name: 'A' });
    fireEvent.contextMenu(tab, { clientX: 180, clientY: 70, button: 2 });
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ position: 'fixed', left: '180px', top: '70px' });
    expect(screen.getByRole('menuitem', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(tab).toHaveFocus();
  });

  it.each([
    { x: 975, y: 950, left: '770px', top: '657px' },
    { x: -10, y: -5, left: '8px', top: '8px' },
    { x: 0, y: 0, left: '8px', top: '8px' },
  ])('keeps the menu within viewport edges for pointer $x,$y', ({ x, y, left, top }) => {
    renderTabs();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'A' }), { clientX: x, clientY: y, button: 2 });
    expect(screen.getByRole('menu')).toHaveStyle({ left, top });
  });

  it('constrains a menu in a short, narrow viewport', () => {
    vi.stubGlobal('innerWidth', 160);
    vi.stubGlobal('innerHeight', 180);
    renderTabs();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'A' }), { clientX: 150, clientY: 170, button: 2 });
    expect(screen.getByRole('menu')).toHaveStyle({ left: '8px', top: '8px', maxWidth: '144px', maxHeight: '164px' });
  });

  it('anchors More to its button and toggles it closed without reopening on pointerdown', () => {
    renderTabs();
    const more = screen.getByRole('button', { name: 'More' });
    fireEvent.click(more);
    expect(screen.getByRole('menu')).toHaveStyle({ left: '762px', top: '88px' });
    fireEvent.pointerDown(more);
    fireEvent.click(more);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();
  });

  it.each([{ key: 'ContextMenu' }, { key: 'F10', shiftKey: true }])('anchors keyboard $key to the tab', event => {
    renderTabs();
    const tab = screen.getByRole('button', { name: 'A' });
    tab.focus();
    fireEvent.keyDown(tab, event);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '110px', top: '88px' });
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(tab).toHaveFocus();
  });

  it('moves an open menu to a fresh pointer anchor and refocuses its first command', () => {
    renderTabs();
    const tab = screen.getByRole('button', { name: 'A' });
    fireEvent.contextMenu(tab, { clientX: 180, clientY: 70, button: 2 });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    fireEvent.contextMenu(tab, { clientX: 260, clientY: 90, button: 2 });
    expect(screen.getByRole('menu')).toHaveStyle({ left: '260px', top: '90px' });
    expect(screen.getByRole('menuitem', { name: 'Close' })).toHaveFocus();
  });

  it('owns Escape ahead of a pending overlay when its content is portaled', () => {
    renderTabs();
    const cancelPending = vi.fn();
    const unregister = registerPendingOverlay(window, cancelPending);
    try {
      fireEvent.contextMenu(screen.getByRole('button', { name: 'A' }), { clientX: 180, clientY: 70, button: 2 });
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
      expect(cancelPending).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it('keeps menu scrolling open but dismisses on ancestor scroll and viewport resize', () => {
    renderTabs();
    const tab = screen.getByRole('button', { name: 'A' });
    fireEvent.contextMenu(tab, { clientX: 150, clientY: 70, button: 2 });
    fireEvent.scroll(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.scroll(screen.getByTestId('page-tab-scroll'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(tab).toHaveFocus();
    fireEvent.contextMenu(tab, { clientX: 150, clientY: 70, button: 2 });
    fireEvent.resize(window);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(tab, { clientX: 150, clientY: 70, button: 2 });
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('skips disabled commands with arrows/Home/End and executes against the originating tab', () => {
    const props = renderTabs();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Home' }), { key: 'ContextMenu' });
    const menu = screen.getByRole('menu');
    expect(screen.getByRole('menuitem', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Unpin' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Refresh' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: 'Close all' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Refresh' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Close all' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Refresh' }));
    expect(props.onCommand).toHaveBeenCalledWith('refresh', 'home');
    expect(screen.getByRole('button', { name: 'Home' })).toHaveFocus();
  });
});
