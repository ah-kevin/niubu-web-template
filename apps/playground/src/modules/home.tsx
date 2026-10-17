import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@niubu/locales/react';
import { usePlaygroundApi } from '../app/api-context';
import { RequestFailure } from './status';
import { Button } from '@niubu/shadcn-ui/button';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Boxes, Database, ShieldCheck } from '@niubu/icons';
import { ExamplePage, ExampleSection } from '../examples/ExamplePage';
import { useAuthSnapshot } from '../auth/context';
import { withScope } from '../auth/scope';
import { resolvePlaygroundAccess } from '../auth/access';

export function HomePage() {
  const api = usePlaygroundApi();
  const { t } = useTranslation('app');
  const state = useAuthSnapshot();
  const grantedPages = new Set(resolvePlaygroundAccess(state).grantedPageIds);
  const health = useQuery({ queryKey: ['playground', 'health'], queryFn: ({ signal }) => api.health(signal) });
  const entries = [
    {
      title: 'navigation.components',
      help: 'home.componentsHelp',
      href: '/examples/components',
      pageId: 'playground.examples.components',
      Icon: Boxes,
    },
    {
      title: 'navigation.features',
      help: 'home.featuresHelp',
      href: '/examples/query',
      pageId: 'playground.examples.query',
      Icon: Database,
    },
    {
      title: 'navigation.system',
      help: 'home.systemHelp',
      href: '/system/users',
      pageId: 'playground.system.users',
      Icon: ShieldCheck,
    },
  ].filter(entry => grantedPages.has(entry.pageId));
  return (
    <ExamplePage title={t('home')} description={t('home.description')} className="[margin:0]">
      <div className="grid min-w-0 gap-[var(--workspace-section-gap)] lg:grid-cols-3">
        {entries.map(({ title, help, href, Icon }) => (
          <ExampleSection
            key={href}
            title={t(title)}
            className="flex flex-col"
            bodyClassName="flex-1 content-start"
            footer={
              <Button asChild variant="outline">
                <Link to={href + withScope('', state.scope)}>
                  {t('home.open')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          >
            <Icon className="size-7 text-primary-text" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">{t(help)}</p>
          </ExampleSection>
        ))}
        {!state.user && (
          <ExampleSection
            title={t('login')}
            className="lg:col-span-3"
            footer={
              <Button asChild>
                <Link to="/login">{t('login')}</Link>
              </Button>
            }
          >
            <p className="text-sm leading-relaxed text-muted-foreground">{t('loginDescription')}</p>
          </ExampleSection>
        )}
      </div>
      <ExampleSection
        title={t('home.service')}
        actions={
          <Button type="button" variant="outline" onClick={() => void health.refetch()} disabled={health.isFetching}>
            {t('retry')}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Activity className="size-5 text-primary-text" aria-hidden="true" />
          {health.isPending && <p role="status">health: {t('pending')}</p>}
          {health.data?.ok && <p role="status">health: {health.data.data.status}</p>}
          {health.data && !health.data.ok && <RequestFailure name="health" error={health.data.error} />}
          {health.isError && <p role="alert">health: transport</p>}
        </div>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </ExampleSection>
    </ExamplePage>
  );
}
