import { useParams } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot } from './context';
import { resolvePlaygroundAccess } from './access';
export function EmbeddedPage() {
  const state = useAuthSnapshot(),
    { menuId } = useParams(),
    { t } = useTranslation('app');
  const item = resolvePlaygroundAccess(state).iframeItems.find(item => item.id === menuId);
  if (!item)
    return (
      <section className="playground-page">
        <h1>{t('forbidden')}</h1>
      </section>
    );
  const title = item.title.startsWith('app:') ? t(item.title) : item.title;
  return (
    <section className="playground-page">
      <h1>{title}</h1>
      <iframe
        key={`${state.user?.id}:${state.scope?.kind}:${state.scope?.id}:${item.id}`}
        title={title}
        src={item.src}
        sandbox="allow-scripts allow-forms"
        referrerPolicy="no-referrer"
        className="playground-frame"
      />
    </section>
  );
}
