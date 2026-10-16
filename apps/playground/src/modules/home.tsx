import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@niubu/locales/react';
import { usePlaygroundApi } from '../app/api-context';
import { RequestFailure } from './status';

export function HomePage() {
  const api = usePlaygroundApi();
  const { t } = useTranslation('app');
  const health = useQuery({ queryKey: ['playground', 'health'], queryFn: ({ signal }) => api.health(signal) });
  return (
    <section className="playground-page">
      <h1>{t('home')}</h1>
      <p>{t('intro')}</p>
      {health.isPending && <p role="status">health: {t('pending')}</p>}
      {health.data?.ok && <p role="status">health: {health.data.data.status}</p>}
      {health.data && !health.data.ok && <RequestFailure name="health" error={health.data.error} />}
      {health.isError && <p role="alert">health: transport</p>}
      <button type="button" onClick={() => void health.refetch()} disabled={health.isFetching}>
        {t('retry')}
      </button>
    </section>
  );
}
