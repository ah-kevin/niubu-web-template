import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@niubu/locales/react';
import { usePlaygroundApi } from '../app/api-context';
import { RequestFailure } from './status';
import { Button } from '@niubu/shadcn-ui/button';

export function HomePage() {
  const api = usePlaygroundApi();
  const { t } = useTranslation('app');
  const health = useQuery({ queryKey: ['playground', 'health'], queryFn: ({ signal }) => api.health(signal) });
  return (
    <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
      <h1>{t('home')}</h1>
      <p>{t('intro')}</p>
      {health.isPending && <p role="status">health: {t('pending')}</p>}
      {health.data?.ok && <p role="status">health: {health.data.data.status}</p>}
      {health.data && !health.data.ok && <RequestFailure name="health" error={health.data.error} />}
      {health.isError && <p role="alert">health: transport</p>}
      <Button type="button" onClick={() => void health.refetch()} disabled={health.isFetching}>
        {t('retry')}
      </Button>
    </section>
  );
}
