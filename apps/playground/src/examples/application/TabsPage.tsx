import { useApplicationText } from './copy';
import { Input } from '@niubu/shadcn-ui/input';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { createTabStore, type PageTab } from '@niubu/stores';
import { useAppStores } from '@niubu/stores/react';
import { usePageTabs } from '@niubu/layouts/routing';
import { Button } from '@niubu/shadcn-ui/button';
import { withScope } from '../../auth/scope';
import { useAuthSnapshot } from '../../auth/context';
function TabActions() {
  const text = useApplicationText();
  const tabs = usePageTabs();
  const stores = useAppStores();
  const active = tabs.snapshot.activeKey;
  return (
    <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
      <Button disabled={!active} onClick={() => active && tabs.request({ type: 'refresh', key: active })}>
        {text('refresh')}
      </Button>
      <Button
        disabled={!active || active === tabs.snapshot.homeKey}
        onClick={() => active && tabs.request({ type: 'close', key: active })}
      >
        {text('close')}
      </Button>
      <Button
        disabled={!active || active === tabs.snapshot.homeKey}
        onClick={() => {
          const tab = tabs.snapshot.tabs.find(t => t.key === active);
          if (tab) stores.tabs.pin(tab.key, !tab.pinned);
        }}
      >
        {text('pin')}
      </Button>
      <p>
        {text('opened')} {tabs.snapshot.tabs.length} {text('tabsCount')}{' '}
        {tabs.snapshot.tabs.find(t => t.key === active)?.refreshNonce ?? 0}
      </p>
    </div>
  );
}
function DetailLinks() {
  const text = useApplicationText();
  const { scope } = useAuthSnapshot();
  return (
    <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
      {['A', 'B'].map(id => (
        <Link key={id} to={`/examples/tabs/${id}${withScope('', scope)}`}>
          {text('openDetail')} {id}
        </Link>
      ))}
      <Link to={`/examples/tabs${withScope('', scope)}`}>{text('backTabs')}</Link>
    </div>
  );
}
const capacityTab = (id: string): PageTab => ({
  key: id,
  routeId: 'synthetic',
  href: `/capacity/${id}`,
  restoreHref: `/capacity/${id}`,
  scopeKey: null,
  pinned: false,
  refreshNonce: 0,
});
export function CapacityExample() {
  const text = useApplicationText();
  const [store] = useState(() => createTabStore({ home: capacityTab('home'), maxCount: 3 }));
  const [next, setNext] = useState(1);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const lifetime = useRef(0);
  useEffect(() => {
    const generation = ++lifetime.current;
    const isCurrent = () => lifetime.current === generation;
    return () =>
      queueMicrotask(() => {
        if (isCurrent()) store.dispose();
      });
  }, [store]);
  return (
    <div className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
      <h2>{text('capacityTitle')}</h2>
      <p>{text('capacityHelp')}</p>
      <Button
        onClick={() => {
          store.open(capacityTab(String(next)), 'ui');
          setNext(n => n + 1);
        }}
      >
        {text('capacityNext')}
      </Button>
      <output aria-label={text('capacityOutput')}>{snapshot.tabs.map(t => t.key).join(', ')}</output>
    </div>
  );
}
export function TabsPage() {
  const text = useApplicationText();
  usePageTabs();
  return (
    <section className="playground-page example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[12px] [&>h1]:text-[24px] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-semibold">
      <h1>{text('tabsTitle')}</h1>
      <p>{text('tabsHelp')}</p>
      <DetailLinks />
      <TabActions />
      <CapacityExample />
    </section>
  );
}
export function TabDetailPage() {
  const text = useApplicationText();
  const { id } = useParams();
  const location = useLocation();
  const [value, setValue] = useState('');
  return (
    <section className="playground-page example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[12px] [&>h1]:text-[24px] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-semibold">
      <h1>
        {text('detailTitle')} {id}
      </h1>
      <p>
        {text('routeIdentity')}
        {location.pathname}
        {text('routeHelp')}
      </p>
      <DetailLinks />
      <TabActions />
      <label>
        {text('temporary')}
        <Input value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <p>{text('temporaryHelp')}</p>
    </section>
  );
}
