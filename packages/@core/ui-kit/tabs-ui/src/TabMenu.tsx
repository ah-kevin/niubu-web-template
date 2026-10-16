import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayBoundaryRef } from '@niubu/shadcn-ui/overlay-ownership';
import type { TabView, TabLabels, TabCommand } from './TabBar';
export type TabMenuAnchor = { x: number; y: number } | { element: HTMLElement; align: 'start' | 'end' };
export function TabMenu({
  tab,
  anchor,
  trigger,
  labels,
  maximized,
  onCommand,
  onClose,
}: {
  tab: TabView;
  anchor: TabMenuAnchor;
  trigger: HTMLElement;
  labels: TabLabels;
  maximized: boolean;
  onCommand: (command: TabCommand, key: string) => void;
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const boundaryRef = useOverlayBoundaryRef(menu);
  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const margin = 8;
    const maxWidth = Math.max(0, window.innerWidth - margin * 2);
    const maxHeight = Math.max(0, window.innerHeight - margin * 2);
    element.style.maxWidth = `${maxWidth}px`;
    element.style.maxHeight = `${maxHeight}px`;
    const measured = element.getBoundingClientRect();
    const width = Math.min(measured.width, maxWidth);
    const height = Math.min(measured.height, maxHeight);
    let x: number;
    let y: number;
    if ('element' in anchor) {
      const bounds = anchor.element.getBoundingClientRect();
      x = anchor.align === 'end' ? bounds.right - width : bounds.left;
      y = bounds.bottom;
    } else {
      x = anchor.x;
      y = anchor.y;
    }
    element.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - width - margin))}px`;
    element.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - height - margin))}px`;
  }, [anchor]);
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.contains(e.target as Node)) onClose();
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', onClose);
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [anchor, onClose, trigger]);
  const commands: readonly [TabCommand, string, boolean][] = [
    ['close', labels.close, !tab.closable],
    ['pin', tab.pinned ? labels.unpin : labels.pin, !tab.closable],
    ['refresh', labels.refresh, false],
    ['maximize', maximized ? labels.restore : labels.maximize, false],
    ['newWindow', labels.newWindow, false],
    ['left', labels.left, false],
    ['right', labels.right, false],
    ['other', labels.other, false],
    ['all', labels.all, false],
  ];
  return createPortal(
    <div
      className="page-tab-menu"
      role="menu"
      aria-label={tab.label}
      style={{ position: 'fixed' }}
      ref={boundaryRef}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          items[
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          ]?.focus();
        }
      }}
    >
      {commands.map(([command, label, disabled]) => (
        <button
          type="button"
          role="menuitem"
          key={command}
          disabled={disabled}
          onClick={() => {
            onCommand(command, tab.key);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
