import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
function createPendingStore(generation: string) {
  const tokens = new Set<symbol>(),
    listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => tokens.size,
    register() {
      const token = Symbol(`route pending:${generation}`);
      tokens.add(token);
      notify();
      return () => {
        if (tokens.delete(token)) notify();
      };
    },
  };
}
const PendingContext = createContext<ReturnType<typeof createPendingStore> | null>(null);
const emptySubscribe = () => () => {};
const noPending = () => 0;
const titleOwners = new WeakMap<Document, symbol>();
export function RoutePresentation({
  title,
  generation,
  appTitle,
  children,
}: {
  title: string;
  generation: string;
  appTitle: string;
  children: ReactNode;
}) {
  const { core } = usePreferenceSnapshot();
  const { t } = useTranslation();
  const store = useMemo(() => createPendingStore(generation), [generation]);
  const pending = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    const previous = document.title,
      owner = Symbol('route title'),
      value = core.general.dynamicTitle ? `${title} · ${appTitle}` : appTitle;
    titleOwners.set(document, owner);
    document.title = value;
    return () => {
      if (titleOwners.get(document) === owner) {
        titleOwners.delete(document);
        if (document.title === value) document.title = previous;
      }
    };
  }, [core.general.dynamicTitle, title, appTitle]);
  return (
    <PendingContext.Provider value={store}>
      {pending > 0 && core.transition.progress && (
        <div
          className="foundation-route-progress fixed inset-x-0 top-0 z-[100] h-[2px] overflow-hidden bg-muted"
          role="progressbar"
          aria-label={t('shell:routeProgress')}
        />
      )}
      {children}
    </PendingContext.Provider>
  );
}
/** Tracking mounts even when decorative loading is disabled. Each generation has its own store. */
export function RoutePending() {
  const store = useContext(PendingContext);
  const { core } = usePreferenceSnapshot();
  const { t } = useTranslation();
  useLayoutEffect(() => store?.register(), [store]);
  return core.transition.loading ? (
    <div className="page-loading p-[60px] text-center text-[13px] text-muted-foreground" role="status">
      {t('shell:pageLoading')}
    </div>
  ) : null;
}
const motionClasses = {
  none: 'route-entry',
  fade: 'route-entry route-entry-fade',
  'fade-down': 'route-entry route-entry-fade-down',
  'fade-slide': 'route-entry route-entry-fade-slide',
  'fade-up': 'route-entry route-entry-fade-up',
} as const;
export function RouteMotion({
  identity,
  refreshNonce,
  children,
}: {
  identity: string;
  refreshNonce: number;
  children: ReactNode;
}) {
  const { core } = usePreferenceSnapshot();
  const element = useRef<HTMLDivElement>(null);
  const store = useContext(PendingContext);
  const pending = useSyncExternalStore(
    store?.subscribe ?? emptySubscribe,
    store?.getSnapshot ?? noPending,
    store?.getSnapshot ?? noPending,
  );
  const style = core.transition.enabled ? core.transition.style : 'none';
  const animated = useRef<string | null>(null);
  useLayoutEffect(() => {
    const node = element.current;
    const signature = JSON.stringify([identity, refreshNonce, style]);
    if (!node || style === 'none') {
      animated.current = null;
      return;
    }
    if (
      (store?.getSnapshot() ?? pending) > 0 ||
      animated.current === signature ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    node.style.animationName = 'none';
    void node.offsetWidth;
    node.style.animationName = '';
    animated.current = signature;
  }, [identity, refreshNonce, style, pending, store]);
  return (
    <div
      ref={element}
      className={motionClasses[pending > 0 ? 'none' : style]}
      data-route-motion={style}
      aria-busy={pending > 0 || undefined}
    >
      {children}
    </div>
  );
}
