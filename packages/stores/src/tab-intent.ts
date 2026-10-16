import type { PageTab, TabSnapshot } from './tabs';
export type TabIntent =
  | Readonly<{ type: 'activate'; key: string }>
  | Readonly<{ type: 'close'; key: string }>
  | Readonly<{ type: 'refresh'; key: string }>
  | Readonly<{ type: 'closeMany'; mode: 'left' | 'right' | 'other' | 'all'; key: string }>;
export type TabIntentPlan = Readonly<{
  allowed: boolean;
  reason?: 'missing-page' | 'protected-page' | 'last-page';
  sourceKey: string | null;
  destination: PageTab | null;
  closeKeys: readonly string[];
  refreshKey: string | null;
  expectedRevision: number;
}>;
export function planTabIntent(intent: TabIntent, s: TabSnapshot): TabIntentPlan {
  const result: TabIntentPlan = {
    allowed: false,
    sourceKey: s.activeKey,
    destination: null,
    closeKeys: [],
    refreshKey: null,
    expectedRevision: s.revision,
  };
  const tab = s.tabs.find(t => t.key === intent.key);
  if (!tab) return { ...result, reason: 'missing-page' };
  if (intent.type === 'activate') return { ...result, allowed: true, destination: tab };
  if (intent.type === 'refresh') return { ...result, allowed: true, destination: tab, refreshKey: tab.key };
  if (intent.type === 'close' && tab.pinned) return { ...result, reason: 'protected-page' };
  const index = s.tabs.indexOf(tab);
  const closeKeys = s.tabs
    .filter(
      (t, i) =>
        !t.pinned &&
        (intent.type === 'close'
          ? t.key === tab.key
          : intent.mode === 'left'
            ? i < index
            : intent.mode === 'right'
              ? i > index
              : intent.mode === 'other'
                ? t.key !== tab.key
                : true),
    )
    .map(t => t.key);
  if (!closeKeys.includes(s.activeKey ?? ''))
    return Object.freeze({ ...result, allowed: true, closeKeys: Object.freeze(closeKeys) });
  const remaining = s.tabs.filter(t => !closeKeys.includes(t.key));
  const destination =
    [...s.visitOrder]
      .reverse()
      .map(k => remaining.find(t => t.key === k))
      .find(Boolean) ??
    remaining.find(t => s.tabs.indexOf(t) >= index) ??
    remaining.at(-1);
  return destination
    ? Object.freeze({ ...result, allowed: true, closeKeys: Object.freeze(closeKeys), destination })
    : { ...result, reason: 'last-page' };
}
