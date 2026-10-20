import { useParams } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot } from './context';
import { resolveStarterAccess } from './access';
import { ExamplePage } from '../examples/ExamplePage';
export function EmbeddedPage() {
  const state = useAuthSnapshot(),
    { menuId } = useParams(),
    { t } = useTranslation('app');
  const item = resolveStarterAccess(state).iframeItems.find(item => item.id === menuId);
  if (!item)
    return (
      <ExamplePage title={t('forbidden')}>
        <div />
      </ExamplePage>
    );
  const title = item.title.startsWith('app:') ? t(item.title) : item.title;
  return (
    <ExamplePage title={title}>
      <iframe
        key={`${state.user?.id}:${state.scope?.kind}:${state.scope?.id}:${item.id}`}
        title={title}
        src={item.src}
        sandbox="allow-scripts allow-forms"
        referrerPolicy="no-referrer"
        className="starter-frame min-h-[max(24rem,calc(100dvh-14rem))] w-full rounded-[var(--radius)] border border-border bg-card"
      />
    </ExamplePage>
  );
}
