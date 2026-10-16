import { useCallback, useEffect, useInsertionEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useAppStores } from '@niubu/stores/react';
import {
  parseTabSession,
  serializeTabSession,
  tabSessionKey,
  planTabIntent,
  type PageTab,
  type ResolvedPageDescriptor,
  type TabIntent,
  type TabIntentPlan,
} from '@niubu/stores';
import { sameAppHref } from '@niubu/core-shared';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
import { ControllerContext, type PageRoutingRuntime, type TabSessionOptions } from './context';
type Pending = { generation: number; plan: TabIntentPlan; href: string; token: string };
/** One controller survives public routes and a hidden tab view. It owns no blocker or unload listener. */
export function PageTabsBinding({
  runtime,
  session,
  children,
}: {
  runtime: PageRoutingRuntime;
  session?: TabSessionOptions;
  children: ReactNode;
}) {
  const stores = useAppStores(),
    location = useLocation(),
    navigate = useNavigate();
  const { core } = usePreferenceSnapshot();
  const [status, setStatus] = useState<string | null>(null);
  const [capacityKey, setCapacityKey] = useState<string | null>(null);
  const admissions = useRef(new Map<string, { source: 'ui' | 'pop'; previousHref: string | null }>());
  const { t } = useTranslation();
  const pending = useRef<Pending | null>(null),
    generation = useRef(0),
    alive = useRef(true);
  const latest = useRef({ location, runtime });
  useInsertionEffect(() => {
    latest.current = { location, runtime };
  }, [location, runtime]);
  const restoreOwner = useRef<string | null>(null);
  const validate = useCallback((href: string): PageTab | null => {
    if (!sameAppHref(href)) return null;
    const url = new URL(href, 'https://template.invalid');
    return latest.current.runtime.resolveTab(latest.current.runtime.describe(url));
  }, []);
  const cancel = useCallback(() => {
    generation.current++;
    pending.current = null;
    admissions.current.clear();
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    stores.tabs.configure({ maxCount: core.tabbar.maxCount, visitHistory: core.tabbar.visitHistory });
  }, [stores, core.tabbar.maxCount, core.tabbar.visitHistory]);
  useEffect(() => {
    if (!session || restoreOwner.current === tabSessionKey(session.identity, session.storageNamespace)) return;
    const key = tabSessionKey(session.identity, session.storageNamespace);
    restoreOwner.current = key;
    const read = session.port.read(key);
    if (!read.ok) {
      queueMicrotask(() => {
        if (alive.current && restoreOwner.current === key) setStatus('storage');
      });
      return;
    }
    if (core.tabbar.persist) {
      stores.tabs.restore(parseTabSession(read.value, validate, session.identity));
    }
  }, [session, stores, validate, core.tabbar.persist]);
  useEffect(() => {
    if (!session) return;
    const key = tabSessionKey(session.identity, session.storageNamespace);
    let previous: string | null | undefined;
    function save() {
      const raw = core.tabbar.persist ? serializeTabSession(stores.tabs.getSnapshot().tabs, session!.identity) : null;
      if (raw === previous) return;
      const result = raw === null ? session!.port.remove(key) : session!.port.write(key, raw);
      const check = session!.port.read(key);
      if (!result.ok || !check.ok || check.value !== raw) {
        setStatus('storage');
        return;
      }
      previous = raw;
      setStatus(current => (current === 'storage' ? null : current));
    }
    save();
    return stores.tabs.subscribe(save);
  }, [session, stores, core.tabbar.persist]);
  useEffect(() => {
    const p = pending.current;
    if (
      p &&
      (location.state?.[latest.current.runtime.intentStateKey] !== p.token ||
        location.pathname + location.search + location.hash !== p.href)
    )
      cancel();
  }, [location, cancel]);
  const preflight = useCallback(
    (next: Location, historyAction: string) => {
      setCapacityKey(null);
      setStatus(current => (current === 'capacity' ? null : current));
      const snapshot = stores.tabs.getSnapshot();
      const href = next.pathname + next.search + next.hash;
      const target = validate(href);
      const nextDescriptor = latest.current.runtime.describe(next);
      const currentDescriptor = latest.current.runtime.describe(latest.current.location);
      const sameUnresolvedPage =
        nextDescriptor.status === 'unresolved' &&
        next.pathname === latest.current.location.pathname &&
        JSON.stringify(nextDescriptor.scope) === JSON.stringify(currentDescriptor.scope);
      const existing = snapshot.tabs.find(
        tab =>
          tab.href === href ||
          tab.restoreHref === href ||
          tab.key === target?.key ||
          (sameUnresolvedPage && tab.key === snapshot.activeKey),
      );
      const directHistory = historyAction === 'POP';
      const candidate =
        target ??
        (sameAppHref(href) && latest.current.runtime.describe(next).status === 'unresolved'
          ? {
              key: '@unresolved:' + href,
              routeId: '',
              href,
              restoreHref: href,
              scopeKey: null,
              pinned: false,
              refreshNonce: 0,
            }
          : null);
      if (!directHistory && !existing && candidate && !stores.tabs.canOpen(candidate)) {
        setCapacityKey(next.key);
        setStatus('capacity');
        cancel();
        return false;
      }
      const previous = snapshot.tabs.find(tab => tab.key === snapshot.activeKey);
      admissions.current.set(next.key, {
        source: directHistory ? 'pop' : 'ui',
        previousHref: previous?.restoreHref ?? null,
      });
      return true;
    },
    [stores, validate, cancel],
  );
  const request = useCallback(
    (intent: TabIntent) => {
      cancel();
      setStatus(null);
      const snapshot = stores.tabs.getSnapshot(),
        plan = planTabIntent(intent, snapshot);
      if (!plan.allowed) {
        setStatus(plan.reason ?? 'missing-page');
        return;
      }
      if (!plan.destination) {
        stores.tabs.commit({ ...plan, destination: undefined });
        return;
      }
      const validated = validate(plan.destination.restoreHref);
      if (!validated || validated.key !== plan.destination.key) {
        setStatus('unavailable');
        return;
      }
      const href = intent.type === 'refresh' ? plan.destination.href : plan.destination.restoreHref;
      if (!sameAppHref(href)) {
        setStatus('unavailable');
        return;
      }
      if (
        intent.type === 'activate' &&
        plan.destination.key === snapshot.activeKey &&
        href === latest.current.location.pathname + latest.current.location.search + latest.current.location.hash
      )
        return;
      const token = `${stores.session.getSnapshot().identityKey}:${++generation.current}`;
      pending.current = { generation: generation.current, plan, href, token };
      void navigate(href, {
        replace: intent.type === 'refresh',
        state: { ...latest.current.location.state, [latest.current.runtime.intentStateKey]: token },
      });
    },
    [cancel, stores, validate, navigate],
  );
  const commit = useCallback(
    (descriptor: ResolvedPageDescriptor) => {
      const current = latest.current.location;
      if (
        !alive.current ||
        descriptor.locationKey !== current.key ||
        descriptor.href !== current.pathname + current.search + current.hash
      )
        return;
      const tab = latest.current.runtime.resolveTab(descriptor);
      if (!tab) {
        if (descriptor.status === 'rejected') cancel();
        return;
      }
      const admission = admissions.current.get(current.key);
      if (admission?.source === 'ui' && !stores.tabs.canOpen(tab)) {
        admissions.current.delete(current.key);
        cancel();
        setStatus('capacity');
        if (admission.previousHref)
          stores.interaction.runWithoutGuard(() => {
            void navigate(admission.previousHref!, { replace: true });
          });
        return;
      }
      admissions.current.delete(current.key);
      const p = pending.current;
      if (p) {
        pending.current = null;
        if (
          current.state?.[latest.current.runtime.intentStateKey] === p.token &&
          p.generation === generation.current &&
          p.plan.destination?.key === tab.key &&
          p.href === descriptor.href
        ) {
          if (!stores.tabs.commit({ ...p.plan, destination: tab })) stores.tabs.open(tab);
        } else stores.tabs.open(tab);
      } else {
        const existing = stores.tabs.getSnapshot().tabs.find(t => t.key === tab.key);
        if (
          !existing ||
          existing.href !== tab.href ||
          existing.restoreHref !== tab.restoreHref ||
          stores.tabs.getSnapshot().activeKey !== tab.key
        )
          stores.tabs.open(tab);
      }
      stores.tabs.retain(t => {
        const checked = validate(t.restoreHref);
        return !!checked && checked.key === t.key;
      });
      const home = latest.current.runtime.resolveTab(latest.current.runtime.home(descriptor.scope));
      stores.tabs.setHome(home);
    },
    [cancel, stores, validate, navigate],
  );
  const observeAttempt = useCallback(
    (next: Location) => {
      if (pending.current && next.state?.[latest.current.runtime.intentStateKey] !== pending.current.token) cancel();
    },
    [cancel],
  );
  const isCurrentAttempt = useCallback((key: string, token: unknown) => {
    void key;
    return !pending.current || token === pending.current.token;
  }, []);
  const controller = useMemo(
    () => ({
      runtime,
      request,
      commit,
      cancel,
      observeAttempt,
      isCurrentAttempt,
      validate,
      status,
      capacityKey,
      preflight,
    }),
    [runtime, request, commit, cancel, observeAttempt, isCurrentAttempt, validate, status, capacityKey, preflight],
  );
  return (
    <ControllerContext value={controller}>
      {status && (
        <span className="page-tabs-status" role="status">
          {t(`shell:tabs.error.${status}`)}
        </span>
      )}
      {children}
    </ControllerContext>
  );
}
