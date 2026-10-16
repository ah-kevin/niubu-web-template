/** Navigation-only values. Business payload, translated labels and drafts never enter this store. */
export type PageTab = Readonly<{
  key: string;
  routeId: string;
  href: string;
  restoreHref: string;
  scopeKey: string | null;
  pinned: boolean;
  refreshNonce: number;
}>;
export type TabSnapshot = Readonly<{
  tabs: readonly PageTab[];
  activeKey: string | null;
  homeKey: string | null;
  visitOrder: readonly string[];
  contentMaximized: boolean;
  revision: number;
  overflow: boolean;
}>;
export type TabCommit = Readonly<{
  closeKeys?: readonly string[];
  destination?: PageTab;
  refreshKey?: string | null;
  expectedRevision?: number;
}>;
export type TabStore = ReturnType<typeof createTabStore>;
export function createTabStore(options: {
  home: PageTab | null;
  maxCount?: number;
  visitHistory?: boolean;
  isProtected?: (key: string) => boolean;
}) {
  let disposed = false,
    maxCount = options.maxCount ?? 0,
    history = options.visitHistory ?? true;
  const listeners = new Set<() => void>();
  let capacityOrder: string[] = options.home ? [options.home.key] : [];
  const freeze = (s: TabSnapshot): TabSnapshot =>
    Object.freeze({
      ...s,
      tabs: Object.freeze(s.tabs.map(t => Object.freeze({ ...t }))),
      visitOrder: Object.freeze([...s.visitOrder]),
    });
  const home = options.home ? { ...options.home, pinned: true } : null;
  let snapshot = freeze({
    tabs: home ? [home] : [],
    activeKey: home?.key ?? null,
    homeKey: home?.key ?? null,
    visitOrder: history && home ? [home.key] : [],
    contentMaximized: false,
    revision: 0,
    overflow: !!home && maxCount > 0 && maxCount < 1,
  });
  const find = (key: string) => snapshot.tabs.find(t => t.key === key);
  function publish(next: Omit<TabSnapshot, 'revision' | 'overflow'>) {
    if (disposed) return;
    snapshot = freeze({
      ...next,
      revision: snapshot.revision + 1,
      overflow: maxCount > 0 && next.tabs.length > maxCount,
    });
    for (const listener of listeners) listener();
  }
  const visited = (key: string, order = snapshot.visitOrder) => (history ? [...order.filter(k => k !== key), key] : []);
  const safe = (t: PageTab) => !t.pinned && t.key !== snapshot.activeKey && !options.isProtected?.(t.key);
  function victims(tab: PageTab): string[] | null {
    if (find(tab.key) || maxCount === 0 || snapshot.tabs.length < maxCount) return [];
    const candidates = snapshot.tabs
      .filter(safe)
      .sort((a, b) => capacityOrder.indexOf(a.key) - capacityOrder.indexOf(b.key));
    const needed = snapshot.tabs.length - maxCount + 1;
    return candidates.length >= needed ? candidates.slice(0, needed).map(t => t.key) : null;
  }
  function fallback(closeKeys: readonly string[]): PageTab | undefined {
    const remaining = snapshot.tabs.filter(t => !closeKeys.includes(t.key) || t.pinned);
    const mru = history
      ? [...snapshot.visitOrder]
          .reverse()
          .map(key => remaining.find(t => t.key === key))
          .find(Boolean)
      : undefined;
    if (mru) return mru;
    const currentIndex = snapshot.tabs.findIndex(t => t.key === snapshot.activeKey);
    return remaining.find(t => snapshot.tabs.indexOf(t) >= currentIndex) ?? remaining.at(-1);
  }
  function commit(plan: TabCommit): boolean {
    if (disposed || (plan.expectedRevision !== undefined && plan.expectedRevision !== snapshot.revision)) return false;
    const closes = new Set((plan.closeKeys ?? []).filter(key => !find(key)?.pinned));
    const destination = plan.destination ?? (closes.has(snapshot.activeKey ?? '') ? fallback([...closes]) : undefined);
    let tabs = snapshot.tabs.filter(t => !closes.has(t.key));
    if (destination) {
      const existing = tabs.find(t => t.key === destination.key);
      const item = existing
        ? { ...destination, pinned: existing.pinned, refreshNonce: existing.refreshNonce }
        : { ...destination };
      tabs = existing ? tabs.map(t => (t.key === item.key ? item : t)) : [...tabs, item];
      tabs = [...tabs.filter(t => t.pinned), ...tabs.filter(t => !t.pinned)];
    }
    if (!tabs.length) return false;
    const activeKey = destination?.key ?? snapshot.activeKey;
    if (activeKey && !tabs.some(t => t.key === activeKey)) return false;
    if (plan.refreshKey)
      tabs = tabs.map(t => (t.key === plan.refreshKey ? { ...t, refreshNonce: t.refreshNonce + 1 } : t));
    let order = snapshot.visitOrder.filter(k => tabs.some(t => t.key === k));
    if (destination) order = visited(destination.key, order);
    capacityOrder = capacityOrder.filter(k => tabs.some(t => t.key === k));
    if (destination) capacityOrder = [...capacityOrder.filter(k => k !== destination.key), destination.key];
    publish({ ...snapshot, tabs, activeKey, visitOrder: order });
    return true;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    canOpen: (tab: PageTab) => !disposed && victims(tab) !== null,
    open(tab: PageTab, source: 'ui' | 'commit' | 'restore' = 'commit') {
      if (disposed) return false;
      const evict = victims(tab);
      if (source === 'ui' && evict === null) return false;
      return commit({ destination: tab, closeKeys: source === 'restore' ? [] : (evict ?? []) });
    },
    restore(restored: readonly PageTab[]) {
      if (disposed || !restored.length) return;
      const values = new Map(snapshot.tabs.map(t => [t.key, t]));
      for (const tab of restored) {
        const existing = values.get(tab.key);
        if (!existing) values.set(tab.key, { ...tab, refreshNonce: 0 });
        else if (tab.pinned && !existing.pinned) values.set(tab.key, { ...existing, pinned: true });
      }
      const tabs = [...values.values()];
      capacityOrder = [...capacityOrder, ...tabs.map(t => t.key).filter(k => !capacityOrder.includes(k))];
      publish({ ...snapshot, tabs: [...tabs.filter(t => t.pinned), ...tabs.filter(t => !t.pinned)] });
    },
    activate(key: string) {
      const t = find(key);
      return t ? commit({ destination: t }) : false;
    },
    close(key: string) {
      return !disposed && !!find(key) && !find(key)?.pinned && commit({ closeKeys: [key] });
    },
    closeMany(keys: readonly string[]) {
      return commit({ closeKeys: keys });
    },
    fallback,
    commit,
    setHome(tab: PageTab | null) {
      if (disposed || snapshot.homeKey === tab?.key || (!tab && !snapshot.homeKey)) return;
      let tabs = snapshot.tabs.map(t => (t.key === snapshot.homeKey ? { ...t, pinned: false } : t));
      if (tab) tabs = [{ ...tab, pinned: true }, ...tabs.filter(t => t.key !== tab.key)];
      tabs = [...tabs.filter(t => t.pinned), ...tabs.filter(t => !t.pinned)];
      if (tab && !capacityOrder.includes(tab.key)) capacityOrder.push(tab.key);
      const activeKey = tabs.some(t => t.key === snapshot.activeKey)
        ? snapshot.activeKey
        : (tab?.key ?? tabs[0]?.key ?? null);
      publish({
        ...snapshot,
        tabs,
        homeKey: tab?.key ?? null,
        activeKey,
        visitOrder: snapshot.visitOrder.filter(k => tabs.some(t => t.key === k)),
      });
    },
    retain(validate: (tab: PageTab) => boolean) {
      if (disposed) return;
      const tabs = snapshot.tabs.filter(validate);
      if (tabs.length === snapshot.tabs.length) return;
      capacityOrder = capacityOrder.filter(key => tabs.some(tab => tab.key === key));
      publish({
        ...snapshot,
        tabs,
        homeKey: tabs.some(t => t.key === snapshot.homeKey) ? snapshot.homeKey : null,
        activeKey: tabs.some(t => t.key === snapshot.activeKey) ? snapshot.activeKey : null,
        visitOrder: snapshot.visitOrder.filter(k => tabs.some(t => t.key === k)),
      });
    },
    pin(key: string, pinned: boolean) {
      const t = find(key);
      if (disposed || !t || key === snapshot.homeKey || t.pinned === pinned) return;
      const tabs = snapshot.tabs.map(t => (t.key === key ? { ...t, pinned } : t));
      publish({ ...snapshot, tabs: [...tabs.filter(t => t.pinned), ...tabs.filter(t => !t.pinned)] });
    },
    reorder(keys: readonly string[]) {
      if (
        disposed ||
        keys.length !== snapshot.tabs.length ||
        new Set(keys).size !== keys.length ||
        keys.some(k => !find(k))
      )
        return false;
      const tabs = keys.map(k => find(k)!);
      if (tabs.some((t, i) => t.pinned && tabs.slice(0, i).some(p => !p.pinned))) return false;
      if (tabs.every((t, i) => t === snapshot.tabs[i])) return true;
      publish({ ...snapshot, tabs });
      return true;
    },
    refresh(key: string) {
      return !!find(key) && commit({ refreshKey: key });
    },
    setMaximized(contentMaximized: boolean) {
      if (!disposed && contentMaximized !== snapshot.contentMaximized) publish({ ...snapshot, contentMaximized });
    },
    configure(next: { maxCount?: number; visitHistory?: boolean }) {
      if (disposed) return;
      const count = next.maxCount === undefined ? maxCount : Math.max(0, Math.floor(next.maxCount));
      const enabled = next.visitHistory ?? history;
      if (count === maxCount && enabled === history) return;
      maxCount = count;
      history = enabled;
      publish({ ...snapshot, visitOrder: history ? snapshot.visitOrder : [] });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      capacityOrder = [];
      snapshot = freeze({
        ...snapshot,
        tabs: [],
        activeKey: null,
        homeKey: null,
        visitOrder: [],
        contentMaximized: false,
      });
    },
  };
}
