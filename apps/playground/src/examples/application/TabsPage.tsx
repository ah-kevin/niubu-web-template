import { useApplicationText } from './copy';
import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
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
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={!active} onClick={() => active && tabs.request({ type: 'refresh', key: active })}>
        {text('refresh')}
      </Button>
      <Button
        variant="outline"
        disabled={!active || active === tabs.snapshot.homeKey}
        onClick={() => active && tabs.request({ type: 'close', key: active })}
      >
        {text('close')}
      </Button>
      <Button
        variant="outline"
        disabled={!active || active === tabs.snapshot.homeKey}
        onClick={() => {
          const tab = tabs.snapshot.tabs.find(t => t.key === active);
          if (tab) stores.tabs.pin(tab.key, !tab.pinned);
        }}
      >
        {text('pin')}
      </Button>
      <p className="w-full rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
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
    <div className="flex flex-wrap items-center gap-2">
      {['A', 'B'].map(id => (
        <Button key={id} variant={id === 'A' ? 'default' : 'outline'} asChild>
          <Link to={`/examples/tabs/${id}${withScope('', scope)}`}>
            {text('openDetail')} {id}
          </Link>
        </Button>
      ))}
      <Button variant="outline" asChild>
        <Link to={`/examples/tabs${withScope('', scope)}`}>{text('backTabs')}</Link>
      </Button>
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
    <ExampleSection title={text('capacityTitle')} description={text('capacityIntro')}>
      <Button
        className="justify-self-start"
        onClick={() => {
          store.open(capacityTab(String(next)), 'ui');
          setNext(n => n + 1);
        }}
      >
        {text('capacityNext')}
      </Button>
      <output
        className="block break-words rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 font-mono text-sm"
        aria-live="polite"
        aria-label={text('capacityOutput')}
      >
        {snapshot.tabs.map(t => t.key).join(', ')}
      </output>
    </ExampleSection>
  );
}
export function TabsPage() {
  const text = useApplicationText();
  usePageTabs();
  return (
    <ExamplePage title={text('tabsTitle')} description={text('tabsIntro')}>
      <div className="grid min-w-0 gap-[var(--workspace-section-gap)] xl:grid-cols-2">
        <ExampleSection title={text('detailTitle')} description={text('detailIntro')}>
          <DetailLinks />
        </ExampleSection>
        <ExampleSection title={text('currentTab')} description={text('currentTabIntro')}>
          <TabActions />
        </ExampleSection>
        <CapacityExample />
      </div>
      <ExampleDetails title={text('implementation')}>
        <p>{text('tabsHelp')}</p>
        <p>{text('capacityHelp')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}
export function TabDetailPage() {
  const text = useApplicationText();
  const { id } = useParams();
  const location = useLocation();
  const [value, setValue] = useState('');
  return (
    <ExamplePage title={`${text('detailTitle')} ${id}`} description={text('detailIntro')} actions={<DetailLinks />}>
      <div className="grid min-w-0 gap-[var(--workspace-section-gap)] xl:grid-cols-2">
        <ExampleSection title={text('temporary')} description={text('temporaryHelp')}>
          <label className="grid gap-2 text-sm">
            {text('temporary')}
            <Input value={value} onChange={e => setValue(e.target.value)} />
          </label>
        </ExampleSection>
        <ExampleSection title={text('currentTab')}>
          <TabActions />
        </ExampleSection>
      </div>
      <ExampleDetails title={text('implementation')}>
        <p>
          {text('routeIdentity')}
          {location.pathname}
          {text('routeHelp')}
        </p>
      </ExampleDetails>
    </ExamplePage>
  );
}
