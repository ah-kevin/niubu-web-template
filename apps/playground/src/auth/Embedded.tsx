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
      <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
        <h1>{t('forbidden')}</h1>
      </section>
    );
  const title = item.title.startsWith('app:') ? t(item.title) : item.title;
  return (
    <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
      <h1>{title}</h1>
      <iframe
        key={`${state.user?.id}:${state.scope?.kind}:${state.scope?.id}:${item.id}`}
        title={title}
        src={item.src}
        sandbox="allow-scripts allow-forms"
        referrerPolicy="no-referrer"
        className="playground-frame min-h-96 w-full border border-border"
      />
    </section>
  );
}
