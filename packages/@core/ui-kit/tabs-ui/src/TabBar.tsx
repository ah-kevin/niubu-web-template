import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, CircleAlert, LockKeyhole, Maximize, RefreshCw, X } from '@niubu/icons';
import { TabMenu, type TabMenuAnchor } from './TabMenu';
export type TabView = Readonly<{ key: string; label: string; pinned: boolean; closable: boolean; icon?: ReactNode }>;
export type TabCommand = 'close' | 'pin' | 'refresh' | 'maximize' | 'newWindow' | 'left' | 'right' | 'other' | 'all';
export type TabLabels = Readonly<
  Record<
    | 'navigation'
    | 'close'
    | 'pin'
    | 'unpin'
    | 'refresh'
    | 'maximize'
    | 'restore'
    | 'newWindow'
    | 'left'
    | 'right'
    | 'other'
    | 'all'
    | 'more'
    | 'previous'
    | 'next'
    | 'overflow',
    string
  >
>;
export type TabBarProps = Readonly<{
  tabs: readonly TabView[];
  activeKey: string | null;
  labels: TabLabels;
  draggable: boolean;
  wheelable: boolean;
  middleClickClose: boolean;
  showMore: boolean;
  showMaximize: boolean;
  showRefresh: boolean;
  showIcon: boolean;
  style: 'brisk' | 'card' | 'chrome' | 'plain';
  maximized: boolean;
  overflow?: boolean;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  onReorder: (keys: readonly string[]) => void;
  onCommand: (command: TabCommand, key: string) => void;
}>;
export function TabBar(p: TabBarProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const [menu, setMenu] = useState<{ key: string; anchor: TabMenuAnchor; trigger: HTMLElement } | null>(null);
  const [overflow, setOverflow] = useState(false);
  const closeMenu = useCallback(() => setMenu(null), [setMenu]);
  const selected = p.tabs.find(t => t.key === menu?.key);
  useEffect(() => {
    const current = scroll.current;
    const update = () => setOverflow(!!current && current.scrollWidth > current.clientWidth);
    update();
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (current) observer?.observe(current);
    const active = current?.querySelector<HTMLElement>('[aria-current="page"]');
    const item = active?.parentElement;
    if (current && item) {
      const left = item.offsetLeft,
        right = left + item.offsetWidth;
      if (left < current.scrollLeft) current.scrollLeft = left;
      else if (right > current.scrollLeft + current.clientWidth) current.scrollLeft = right - current.clientWidth;
    }
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [p.tabs, p.activeKey]);
  useEffect(() => {
    const current = scroll.current;
    if (!current || !p.wheelable) return;
    const wheel = (event: WheelEvent) => {
      if (current.scrollWidth > current.clientWidth) {
        event.preventDefault();
        current.scrollLeft += event.deltaY || event.deltaX;
      }
    };
    current.addEventListener('wheel', wheel, { passive: false });
    return () => current.removeEventListener('wheel', wheel);
  }, [p.wheelable]);
  function reorder(from: string, to: string) {
    const a = p.tabs.findIndex(t => t.key === from),
      b = p.tabs.findIndex(t => t.key === to);
    if (!p.draggable || a < 0 || b < 0 || a === b || p.tabs[a].pinned !== p.tabs[b].pinned) return;
    const keys = p.tabs.map(t => t.key);
    keys.splice(a, 1);
    keys.splice(b, 0, from);
    p.onReorder(keys);
  }
  const move = (direction: number) => {
    if (scroll.current) scroll.current.scrollLeft += direction * Math.max(100, scroll.current.clientWidth * 0.7);
  };
  return (
    <nav className="page-tabbar" data-style={p.style} aria-label={p.labels.navigation}>
      {overflow && (
        <button type="button" className="page-tab-tool" aria-label={p.labels.previous} onClick={() => move(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
      )}
      <div className="page-tab-scroll" ref={scroll} data-testid="page-tab-scroll">
        {p.tabs.map((tab, index) => (
          <div
            className="page-tab"
            data-active={p.activeKey === tab.key}
            data-pinned={tab.pinned}
            key={tab.key}
            draggable={p.draggable}
            onDragStart={event => {
              drag.current = tab.key;
              event.dataTransfer?.setData('text/plain', tab.key);
            }}
            onDragEnd={() => {
              drag.current = null;
            }}
            onDragOver={event => {
              if (drag.current && p.tabs.find(t => t.key === drag.current)?.pinned === tab.pinned)
                event.preventDefault();
            }}
            onDrop={event => {
              event.preventDefault();
              if (drag.current) reorder(drag.current, tab.key);
              drag.current = null;
            }}
            onContextMenu={event => {
              event.preventDefault();
              const trigger = event.currentTarget.querySelector<HTMLButtonElement>('.page-tab-title');
              if (!trigger) return;
              trigger.focus({ preventScroll: true });
              setMenu({
                key: tab.key,
                trigger,
                anchor:
                  event.button !== 2 && event.clientX === 0 && event.clientY === 0
                    ? { element: event.currentTarget, align: 'start' }
                    : { x: event.clientX, y: event.clientY },
              });
            }}
            onAuxClick={event => {
              if (event.button === 1 && p.middleClickClose && tab.closable && !tab.pinned) {
                event.preventDefault();
                p.onClose(tab.key);
              }
            }}
          >
            {p.style === 'chrome' && (
              <span className="page-tab-shape" aria-hidden="true">
                <span className="page-tab-shape-body" />
                <svg className="page-tab-shoulder-left" width="7" height="7" viewBox="0 0 7 7">
                  <path d="M 0 7 A 7 7 0 0 0 7 0 L 7 7 Z" />
                </svg>
                <svg className="page-tab-shoulder-right" width="7" height="7" viewBox="0 0 7 7">
                  <path d="M 0 0 A 7 7 0 0 0 7 7 L 0 7 Z" />
                </svg>
              </span>
            )}
            <button
              type="button"
              className="page-tab-title"
              aria-current={p.activeKey === tab.key ? 'page' : undefined}
              onClick={() => p.onActivate(tab.key)}
              onKeyDown={event => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault();
                  setMenu({
                    key: tab.key,
                    trigger: event.currentTarget,
                    anchor: { element: event.currentTarget.parentElement!, align: 'start' },
                  });
                } else if (event.altKey && event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                  event.preventDefault();
                  const target = p.tabs[index + (event.key === 'ArrowLeft' ? -1 : 1)];
                  if (target) reorder(tab.key, target.key);
                } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const buttons = scroll.current?.querySelectorAll<HTMLButtonElement>('.page-tab-title');
                  buttons?.[
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? p.tabs.length - 1
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + p.tabs.length) % p.tabs.length
                  ]?.focus();
                }
              }}
            >
              {p.showIcon && tab.icon}
              <span>{tab.label}</span>
              {tab.pinned && (
                <span aria-hidden="true" className="page-tab-pin">
                  <LockKeyhole aria-hidden="true" />
                </span>
              )}
            </button>
            {tab.closable && !tab.pinned && (
              <button
                type="button"
                className="page-tab-close"
                onPointerDown={event => {
                  if (event.button === 0) event.preventDefault();
                }}
                onMouseDown={event => event.preventDefault()}
                aria-label={`${p.labels.close} ${tab.label}`}
                onClick={event => {
                  const button = event.currentTarget,
                    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  p.onClose(tab.key);
                  queueMicrotask(() => {
                    if (
                      button.isConnected ||
                      (document.activeElement !== document.body && document.activeElement !== null)
                    )
                      return;
                    if (previous?.isConnected && previous !== button) previous.focus({ preventScroll: true });
                    else
                      scroll.current
                        ?.querySelector<HTMLElement>('[aria-current="page"]')
                        ?.focus({ preventScroll: true });
                  });
                }}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {overflow && (
        <button type="button" className="page-tab-tool" aria-label={p.labels.next} onClick={() => move(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      )}
      {p.overflow && (
        <span className="page-tab-overflow" role="status" title={p.labels.overflow}>
          <CircleAlert aria-hidden="true" />
        </span>
      )}
      {p.activeKey && p.showRefresh && (
        <button
          type="button"
          className="page-tab-tool"
          aria-label={p.labels.refresh}
          onClick={() => p.onCommand('refresh', p.activeKey!)}
        >
          <RefreshCw aria-hidden="true" />
        </button>
      )}
      {p.activeKey && p.showMaximize && (
        <button
          type="button"
          className="page-tab-tool"
          aria-label={p.maximized ? p.labels.restore : p.labels.maximize}
          onClick={() => p.onCommand('maximize', p.activeKey!)}
        >
          <Maximize aria-hidden="true" />
        </button>
      )}
      {p.activeKey && p.showMore && (
        <button
          type="button"
          className="page-tab-tool"
          aria-label={p.labels.more}
          aria-haspopup="menu"
          aria-expanded={!!selected && !!menu && 'element' in menu.anchor && menu.anchor.align === 'end'}
          onClick={event =>
            setMenu(
              menu?.trigger === event.currentTarget
                ? null
                : {
                    key: p.activeKey!,
                    trigger: event.currentTarget,
                    anchor: { element: event.currentTarget, align: 'end' },
                  },
            )
          }
        >
          <ChevronDown aria-hidden="true" />
        </button>
      )}
      {selected && menu && (
        <TabMenu
          tab={selected}
          anchor={menu.anchor}
          trigger={menu.trigger}
          labels={p.labels}
          maximized={p.maximized}
          onCommand={p.onCommand}
          onClose={closeMenu}
        />
      )}
    </nav>
  );
}
