import {
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { WidgetId } from '@niubu/core-preferences';
import { widgetIds } from '@niubu/core-preferences';
import { PendingOverlay } from '@niubu/layout-ui';
import { usePreferenceManager, usePreferenceSnapshot, type PersistenceResult } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
import {
  Search,
  SlidersHorizontal,
  Bell,
  Sun,
  Moon,
  Check,
  Globe,
  Maximize,
  RefreshCw,
  Clock,
  Settings2,
} from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@niubu/shadcn-ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  Select,
  Tooltip,
} from '@niubu/shadcn-ui/preference-primitives';
import { shortcutHint } from '@niubu/hooks';
import { resolveWidgetPlacement } from './widget-placement';
import type { FoundationToolsProps } from './foundation-types';
import { useOverlaySession } from '../hooks/useOverlaySession';
import { useShellShortcuts } from '../hooks/useShellShortcuts';
import { useFullscreen } from '../hooks/useFullscreen';
const CommandSearchDialog = lazy(() => import('./CommandSearchDialog'));
const NotificationSheet = lazy(() => import('./NotificationSheet'));
const icons = {
  search: Search,
  preferences: SlidersHorizontal,
  theme: Sun,
  language: Globe,
  timezone: Clock,
  fullscreen: Maximize,
  refresh: RefreshCw,
  notification: Bell,
};
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const subscribeSystemDark = (notify: () => void) => {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
};
/** One stable shell owner; moving a launcher never recreates a manager, route, or overlay owner. */
export function FoundationTools({
  search,
  notifications,
  renderPreferences,
  identityNote,
  sessionKey,
  headerAvailable,
  headerTarget,
  onRefresh,
  shortcutsEnabled = true,
  quickAppearance = false,
}: FoundationToolsProps) {
  const { t, snapshot: localeStatus } = useTranslation();
  const manager = usePreferenceManager();
  const { core } = usePreferenceSnapshot();
  const prefersDark = useSyncExternalStore(subscribeSystemDark, systemDark);
  const dark = core.theme.mode === 'dark' || (core.theme.mode === 'system' && prefersDark);
  const recovery = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const fixedMenuTrigger = useRef<HTMLButtonElement>(null);
  const [narrowWindow, setNarrowWindow] = useState(() => window.innerWidth <= 900);
  useLayoutEffect(() => {
    const resize = () => setNarrowWindow(window.innerWidth <= 900);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const [headerWidth, setHeaderWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!headerAvailable || !headerTarget) return;
    const measure = () => setHeaderWidth(headerTarget.clientWidth || null);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(headerTarget);
    return () => observer.disconnect();
  }, [headerAvailable, headerTarget]);
  const lifecycleKey = useMemo(() => ({ sessionKey, manager }), [sessionKey, manager]);
  const [kind, setKind] = useState<WidgetId>('preferences');
  const overlay = useOverlaySession(
    lifecycleKey,
    () =>
      recovery.current ??
      document.querySelector<HTMLElement>(
        `[data-widget-id="${kind}"][data-widget-position="header"], [data-widget-id="${kind}"][data-widget-position="fixed"]`,
      ) ??
      fixedMenuTrigger.current ??
      menuTrigger.current ??
      document.querySelector<HTMLElement>('[data-widget-id="preferences"]') ??
      document.getElementById('main-content'),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [fixedMenuOpen, setFixedMenuOpen] = useState(false);
  const [quickResult, setQuickResult] = useState<PersistenceResult | null>(null);
  const [quickOwner, setQuickOwner] = useState(manager);
  if (quickOwner !== manager) {
    setQuickOwner(manager);
    setQuickResult(null);
  }
  const updateQuick = (patch: Parameters<typeof manager.update>[0]) => {
    const result = manager.update(patch);
    setQuickResult(result);
  };
  const fullscreen = useFullscreen();
  const id = useId();
  const open = (next: WidgetId, target?: HTMLElement | null) => {
    setMenuOpen(false);
    setFixedMenuOpen(false);
    setQuickResult(null);
    setKind(next);
    overlay.openOverlay(target);
  };
  useShellShortcuts(
    {
      search: () => {
        if (overlay.open && kind === 'search') {
          overlay.close();
          overlay.returnFocus();
        } else open('search');
      },
      preferences: () => {
        if (overlay.open && kind === 'preferences') {
          overlay.close();
          overlay.returnFocus();
        } else open('preferences');
      },
    },
    { enabled: shortcutsEnabled },
  );
  const label = (widget: WidgetId) =>
    widget === 'search'
      ? t('shell:search.trigger')
      : widget === 'preferences'
        ? t('shell:displayPreferences')
        : widget === 'notification'
          ? t('shell:notifications')
          : widget === 'fullscreen' && fullscreen.snapshot.active
            ? t('shell:tools.exitFullscreen')
            : t(`shell:tools.${widget}`);
  const quickFieldLabel = t(
    kind === 'theme'
      ? 'shell:preferences.field.theme.mode'
      : kind === 'language'
        ? 'shell:preferences.field.locale'
        : 'shell:preferences.field.general.displayTimeZone',
  );
  const activate = (widget: WidgetId, target?: HTMLElement | null) => {
    if (quickAppearance && widget === 'theme') updateQuick({ theme: { mode: dark ? 'light' : 'dark' } });
    else if (widget === 'fullscreen') void fullscreen.toggle();
    else if (widget === 'refresh') onRefresh?.();
    else open(widget, target);
  };
  const available = headerAvailable && Boolean(headerTarget);
  const groups = { header: [] as WidgetId[], fixed: [] as WidgetId[], 'user-dropdown': [] as WidgetId[] };
  for (const widget of widgetIds)
    if (core.widget[widget].enabled)
      groups[resolveWidgetPlacement(core.widget[widget].position, available)].push(widget);
  // Narrow windows use one existing live chrome slot, independent of stored placement.
  if (narrowWindow && available) {
    groups.header = [];
    groups.fixed = [];
    groups['user-dropdown'] = widgetIds.filter(widget => core.widget[widget].enabled);
  }
  // Reserve one 30px control plus its gap for a reachable overflow trigger.
  const headerCount = groups.header.length;
  const hasDropdown = groups['user-dropdown'].length > 0;
  const slots =
    headerWidth === null ? headerCount + Number(hasDropdown) : Math.max(1, Math.floor((headerWidth + 3) / 33));
  const visibleCount = headerCount + Number(hasDropdown) > slots ? Math.max(0, slots - 1) : headerCount;
  groups['user-dropdown'].unshift(...groups.header.splice(visibleCount));
  const fixedMenuWidgets = narrowWindow || groups.fixed.length > 3 ? groups.fixed.splice(0) : [];
  if (!available) fixedMenuWidgets.push(...groups['user-dropdown'].splice(0));
  const trigger = (widget: WidgetId, menu = false, owner: 'header' | 'fixed' = 'header'): ReactNode => {
    const Icon = quickAppearance && widget === 'theme' ? (dark ? Moon : Sun) : icons[widget];
    if (quickAppearance && (widget === 'language' || widget === 'timezone')) {
      const values =
        widget === 'language'
          ? ['zh-CN', 'en-US']
          : [
              ...new Set([
                core.general.displayTimeZone,
                'Asia/Shanghai',
                'UTC',
                'America/New_York',
                'Europe/London',
                'Asia/Tokyo',
              ]),
            ];
      const selected = widget === 'language' ? core.locale : core.general.displayTimeZone;
      const choices = values.map(locale => (
        <DropdownMenuItem
          key={locale}
          onSelect={() => {
            updateQuick(
              widget === 'language'
                ? { locale: locale as typeof core.locale }
                : { general: { displayTimeZone: locale } },
            );
            setMenuOpen(false);
            setFixedMenuOpen(false);
          }}
        >
          <Check size={14} aria-hidden="true" className={selected === locale ? '' : 'invisible'} />
          {widget === 'language' ? t(`shell:preferences.option.${locale}`) : locale}
        </DropdownMenuItem>
      ));
      if (menu)
        return (
          <div key={widget} role="group" aria-label={label(widget)}>
            <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{label(widget)}</p>
            {choices}
          </div>
        );
      return (
        <DropdownMenu key={widget}>
          <Tooltip
            content={widget === 'timezone' ? `${label(widget)} · ${core.general.displayTimeZone}` : label(widget)}
          >
            <DropdownMenuTrigger asChild>
              <Button
                className="foundation-tool-trigger size-[30px] p-0"
                variant="ghost"
                size="icon"
                aria-label={label(widget)}
                data-widget-id={widget}
                data-widget-position={resolveWidgetPlacement(core.widget[widget].position, available)}
              >
                <Icon size={17} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" sideOffset={6}>
              {choices}
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      );
    }
    const direct = ['fullscreen', 'refresh'].includes(widget) || (quickAppearance && widget === 'theme');
    const disabled =
      (widget === 'refresh' && !onRefresh) ||
      (widget === 'fullscreen' &&
        (fullscreen.snapshot.status === 'unsupported' || fullscreen.snapshot.status === 'pending'));
    const title =
      widget === 'search'
        ? `${label(widget)} (${shortcutHint(navigator.platform, 'K')})`
        : widget === 'fullscreen' && fullscreen.snapshot.status === 'unsupported'
          ? t('shell:tools.fullscreenUnsupported')
          : label(widget);
    const button = (
      <Button
        className={
          menu
            ? 'h-auto min-h-[34px] w-full justify-start gap-[10px] text-left whitespace-normal'
            : 'foundation-tool-trigger size-[30px] p-0'
        }
        data-widget-id={widget}
        data-widget-position={menu ? 'user-dropdown' : resolveWidgetPlacement(core.widget[widget].position, available)}
        data-slot={direct ? undefined : widget === 'notification' ? 'sheet-trigger' : 'dialog-trigger'}
        data-state={overlay.open && kind === widget ? 'open' : 'closed'}
        variant="ghost"
        size={menu ? 'default' : 'icon'}
        aria-label={label(widget)}
        aria-controls={direct ? undefined : id}
        aria-haspopup={direct ? undefined : 'dialog'}
        aria-expanded={direct ? undefined : overlay.open && kind === widget}
        disabled={disabled}
        aria-pressed={
          widget === 'fullscreen'
            ? fullscreen.snapshot.active
            : quickAppearance && widget === 'theme'
              ? dark
              : undefined
        }
        aria-busy={(widget === 'fullscreen' && fullscreen.snapshot.status === 'pending') || undefined}
        onClick={event =>
          activate(
            widget,
            menu ? (owner === 'fixed' ? fixedMenuTrigger.current : menuTrigger.current) : event.currentTarget,
          )
        }
        title={title}
      >
        <Icon size={17} aria-hidden="true" />
        {menu && <span className="min-w-0 wrap-anywhere">{label(widget)}</span>}
      </Button>
    );
    return menu ? (
      <DropdownMenuItem key={widget} asChild disabled={disabled}>
        {button}
      </DropdownMenuItem>
    ) : (
      <Tooltip key={widget} content={title}>
        {button}
      </Tooltip>
    );
  };
  const toolsMenu = (widgets: WidgetId[], owner: 'header' | 'fixed') =>
    widgets.length > 0 && (
      <DropdownMenu
        open={owner === 'fixed' ? fixedMenuOpen : menuOpen}
        onOpenChange={owner === 'fixed' ? setFixedMenuOpen : setMenuOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            ref={owner === 'fixed' ? fixedMenuTrigger : menuTrigger}
            className="foundation-tool-trigger size-[30px] p-0"
            data-tool-group={owner}
            variant="ghost"
            size="icon"
            aria-label={t('shell:tools.menu')}
          >
            <Settings2 aria-hidden="true" size={17} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            className="foundation-tools-menu z-[70] max-h-[70vh] min-w-[220px] max-w-[calc(100vw_-_24px)] overflow-auto rounded-[var(--radius)] border border-border bg-card p-[8px] text-foreground shadow-[0_8px_24px_#0003]"
            sideOffset={6}
            onCloseAutoFocus={event => {
              if (overlay.open) event.preventDefault();
            }}
          >
            {identityNote && <p className="p-[8px] text-[.75rem] text-muted-foreground">{identityNote}</p>}
            {widgets.map(widget => trigger(widget, true, owner))}
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    );
  const header = (
    <div className="foundation-header-tools flex w-full flex-nowrap items-center justify-end gap-[3px] [&>*]:shrink-0">
      {groups.header.map(widget => trigger(widget))}
      {available && toolsMenu(groups['user-dropdown'], 'header')}
    </div>
  );
  const close = () => overlay.close();
  return (
    <>
      {available && headerTarget && createPortal(header, headerTarget)}
      <div
        className="foundation-fixed-tools fixed right-[12px] bottom-[58px] z-40 flex max-w-[calc(100vw_-_24px)] flex-wrap items-center justify-end gap-[3px] rounded-[var(--radius)] bg-card shadow-[0_3px_12px_#0002] empty:hidden [&>*]:shrink-0"
        aria-label={t('shell:tools.menu')}
      >
        {groups.fixed.map(widget => trigger(widget))}
        {toolsMenu(fixedMenuWidgets, 'fixed')}
      </div>
      {!core.widget.preferences.enabled && (
        <Button
          ref={recovery}
          className="foundation-preferences-recovery fixed right-[12px] bottom-[12px] z-40 bg-card shadow-[0_3px_12px_#0002] dark:bg-card"
          variant="outline"
          size="icon"
          aria-label={t('shell:tools.recoverPreferences')}
          title={t('shell:tools.recoverPreferences')}
          onClick={() => open('preferences', recovery.current)}
        >
          <SlidersHorizontal aria-hidden="true" size={17} />
        </Button>
      )}
      {core.widget.fullscreen.enabled && fullscreen.snapshot.status === 'error' && (
        <p
          className="foundation-tool-status fixed right-[12px] bottom-[96px] z-40 max-w-[300px] bg-card p-[8px] text-[.8rem]"
          role="status"
        >
          {t('shell:tools.fullscreenError')}
        </p>
      )}
      {quickAppearance && (localeStatus.status !== 'ready' || quickResult?.kind === 'memory') && (
        <p
          role="status"
          className="foundation-tool-status fixed right-3 bottom-3 z-40 max-w-sm rounded-md border border-border bg-card p-3 text-sm"
        >
          {localeStatus.status !== 'ready'
            ? t(
                localeStatus.status === 'error' ? 'shell:preferences.localeFailed' : 'shell:preferences.localePending',
                { preferred: localeStatus.preferredLocale, active: localeStatus.activeLocale },
              )
            : t('shell:preferences.notSaved')}
        </p>
      )}
      {overlay.open && (
        <Suspense
          fallback={
            <PendingOverlay
              onCancel={() => {
                overlay.close();
                overlay.returnFocus();
              }}
            />
          }
        >
          {kind === 'preferences' ? (
            renderPreferences({ contentId: id, onClose: close, returnFocus: overlay.returnFocus })
          ) : kind === 'search' ? (
            search.renderDialog ? (
              search.renderDialog({ ...search, contentId: id, onClose: close, returnFocus: overlay.returnFocus })
            ) : (
              <CommandSearchDialog {...search} contentId={id} onClose={close} returnFocus={overlay.returnFocus} />
            )
          ) : kind === 'notification' ? (
            notifications.renderSheet ? (
              notifications.renderSheet({
                ...notifications,
                contentId: id,
                onClose: close,
                returnFocus: overlay.returnFocus,
              })
            ) : (
              <NotificationSheet {...notifications} contentId={id} onClose={close} returnFocus={overlay.returnFocus} />
            )
          ) : (
            <Dialog
              open
              onOpenChange={next => {
                if (!next) close();
              }}
            >
              <DialogContent
                id={id}
                closeLabel={t('common:close')}
                onCloseAutoFocus={event => {
                  event.preventDefault();
                  overlay.returnFocus();
                }}
              >
                <DialogHeader className="pr-12">
                  <DialogTitle>{label(kind)}</DialogTitle>
                  <DialogDescription>
                    {kind === 'timezone' ? t('shell:tools.displayZoneHelp') : t('shell:preferences.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="foundation-quick-body grid min-w-0 gap-4 p-5">
                  <label className="text-sm font-medium" htmlFor={`${id}-value`}>
                    {quickFieldLabel}
                  </label>
                  {kind === 'theme' ? (
                    <Select
                      id={`${id}-value`}
                      className="w-full"
                      label={t('shell:preferences.field.theme.mode')}
                      value={core.theme.mode}
                      options={['light', 'dark', 'system'].map(value => ({
                        value,
                        label: t(`shell:preferences.option.${value}`),
                      }))}
                      onValueChange={value => updateQuick({ theme: { mode: value as typeof core.theme.mode } })}
                    />
                  ) : kind === 'language' ? (
                    <Select
                      id={`${id}-value`}
                      className="w-full"
                      label={t('shell:preferences.field.locale')}
                      value={core.locale}
                      options={['zh-CN', 'en-US'].map(value => ({
                        value,
                        label: t(`shell:preferences.option.${value}`),
                      }))}
                      onValueChange={value => updateQuick({ locale: value as typeof core.locale })}
                    />
                  ) : (
                    <Select
                      id={`${id}-value`}
                      className="w-full"
                      label={t('shell:preferences.field.general.displayTimeZone')}
                      value={core.general.displayTimeZone}
                      options={[
                        ...new Set([
                          core.general.displayTimeZone,
                          'Asia/Shanghai',
                          'UTC',
                          'America/New_York',
                          'Europe/London',
                          'Asia/Tokyo',
                        ]),
                      ].map(value => ({ value, label: value }))}
                      onValueChange={value => updateQuick({ general: { displayTimeZone: value } })}
                    />
                  )}
                  {kind === 'language' && localeStatus.status !== 'ready' && (
                    <p role="status">
                      {t(
                        localeStatus.status === 'error'
                          ? 'shell:preferences.localeFailed'
                          : 'shell:preferences.localePending',
                        { preferred: localeStatus.preferredLocale, active: localeStatus.activeLocale },
                      )}
                    </p>
                  )}
                  {quickResult && (
                    <p role="status">
                      {quickResult.kind === 'memory' ? t('shell:preferences.notSaved') : t('shell:preferences.saved')}
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </Suspense>
      )}
    </>
  );
}
