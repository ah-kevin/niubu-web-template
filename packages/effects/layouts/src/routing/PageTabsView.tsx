import { TabBar, type TabCommand, type TabLabels } from '@niubu/tabs-ui';
import { useAppStores } from '@niubu/stores/react';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
import { sameAppHref } from '@niubu/core-shared';
import { usePageTabs } from './context';
export function PageTabsView() {
  const tabs = usePageTabs(),
    stores = useAppStores(),
    { core } = usePreferenceSnapshot(),
    { t } = useTranslation();
  const labels = Object.fromEntries(
    [
      'navigation',
      'close',
      'pin',
      'unpin',
      'refresh',
      'maximize',
      'restore',
      'newWindow',
      'left',
      'right',
      'other',
      'all',
      'more',
      'previous',
      'next',
      'overflow',
    ].map(k => [k, t(`shell:tabs.${k}`)]),
  ) as TabLabels;
  const command = (command: TabCommand, key: string) => {
    if (command === 'pin') {
      const tab = tabs.snapshot.tabs.find(t => t.key === key);
      if (tab) stores.tabs.pin(key, !tab.pinned);
    } else if (command === 'maximize') stores.tabs.setMaximized(!tabs.snapshot.contentMaximized);
    else if (command === 'newWindow') {
      const tab = tabs.snapshot.tabs.find(t => t.key === key);
      if (tab && tabs.validate(tab.restoreHref)?.key === key && sameAppHref(tab.restoreHref))
        window.open(tab.restoreHref, '_blank', 'noopener,noreferrer');
    } else if (command === 'close' || command === 'refresh') tabs.request({ type: command, key });
    else tabs.request({ type: 'closeMany', key, mode: command });
  };
  return (
    <>
      <TabBar
        {...core.tabbar}
        tabs={tabs.snapshot.tabs.map(tab => ({
          ...tabs.runtime.renderTab(tab),
          key: tab.key,
          pinned: tab.pinned,
          closable: tab.key !== tabs.snapshot.homeKey,
        }))}
        activeKey={tabs.snapshot.activeKey}
        labels={labels}
        maximized={tabs.snapshot.contentMaximized}
        overflow={tabs.snapshot.overflow}
        onActivate={key => tabs.request({ type: 'activate', key })}
        onClose={key => tabs.request({ type: 'close', key })}
        onReorder={keys => stores.tabs.reorder(keys)}
        onCommand={command}
      />
    </>
  );
}
