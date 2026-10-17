import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
import { Button } from '@niubu/shadcn-ui/button';
import { Select } from '@niubu/shadcn-ui/select';
import { useFeaturesText } from './copy';
import { useEffect, useRef, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  contextLabel,
  createQueryFixture,
  syntheticKey,
  SyntheticGetError,
  type QueryFixture,
  type SyntheticContext,
} from './query-fixture';

type SceneProps = { context: SyntheticContext; fixture: QueryFixture };
function Pagination({ context, fixture }: SceneProps) {
  const { t } = useFeaturesText();
  const [page, setPage] = useState(1);
  const key = [...syntheticKey(context), 'page', page];
  const query = useQuery({
    ...queryOptions({
      queryKey: key,
      queryFn: ({ signal }) => fixture.get(key, signal, [page * 2 - 1, page * 2]),
      retry: false,
    }),
    placeholderData: keepPreviousData,
  });
  // The fulfilled page is derived from its rows so placeholder data never receives the new page label.
  const fulfilledPage = query.data ? Math.ceil(query.data.value[0]! / 2) : page;
  return (
    <ExampleSection title={t('query.pagination')}>
      <p>{t('query.page', { page })}</p>
      {query.isPlaceholderData && <p role="status">{t('query.previousData')}</p>}
      {query.isPending && <p role="status">{t('query.loadingPage')}</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <ul className="my-4 grid gap-2 text-sm [&>li]:rounded-lg [&>li]:bg-muted/40 [&>li]:px-3 [&>li]:py-2">
        {query.data?.value.map(id => (
          <li key={id}>{t('query.pageRow', { context: contextLabel(context), page: fulfilledPage, id })}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage(value => value - 1)}
        >
          {t('query.previous')}
        </Button>
        <Button type="button" disabled={page === 3 || query.isFetching} onClick={() => setPage(value => value + 1)}>
          {t('query.next')}
        </Button>
      </div>
    </ExampleSection>
  );
}

function Retry({ context, fixture }: SceneProps) {
  const { t } = useFeaturesText();
  const [scenario, setScenario] = useState({ failure: 'none' as 'none' | 'once' | 'always', run: 0 });
  const key = [...syntheticKey(context), 'safe-GET', scenario.failure, scenario.run];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fixture.get(key, signal, '合成 GET 成功', scenario.failure),
    enabled: scenario.failure !== 'none',
    // This fixture models a safe GET. Other queries do not inherit a retry policy.
    retry: (failureCount, error) => error instanceof SyntheticGetError && failureCount < 1,
    retryDelay: 40,
  });
  return (
    <ExampleSection title={t('query.retry')}>
      <p className="text-sm text-muted-foreground">{t('query.retryHelp')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={query.isFetching}
          onClick={() => setScenario(value => ({ failure: 'once', run: value.run + 1 }))}
        >
          {t('query.retryOnce')}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={query.isFetching}
          onClick={() => setScenario(value => ({ failure: 'always', run: value.run + 1 }))}
        >
          {t('query.fail')}
        </Button>
      </div>
      {query.isFetching && <p role="status">{t('query.runningGet')}</p>}
      {query.data && (
        <p role="status">{t('query.attempts', { value: query.data.value, attempts: query.data.attempts })}</p>
      )}
      {query.error && <p role="alert">{query.error.message}</p>}
    </ExampleSection>
  );
}

function Concurrency({ context, fixture }: SceneProps) {
  const { t, localize } = useFeaturesText();
  const client = useQueryClient();
  const [output, setOutput] = useState('');
  const [pending, setPending] = useState(false);
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function read() {
    setPending(true);
    const key = [...syntheticKey(context), 'concurrent'];
    const options = queryOptions({
      queryKey: key,
      queryFn: ({ signal }) => fixture.get(key, signal, contextLabel(context)),
      staleTime: 60_000,
      retry: false,
    });
    try {
      const [first, second] = await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
      if (live.current) setOutput(`底层 GET 次数：${first.attempts}；两次结果相同：${first === second ? '是' : '否'}`);
    } catch (error) {
      if (live.current) setOutput(error instanceof Error ? error.message : '合成读取失败');
    } finally {
      if (live.current) setPending(false);
    }
  }
  const result = /^底层 GET 次数：(\d+)；两次结果相同：(是|否)$/.exec(output);
  const outputText = result
    ? t('query.concurrentResult', { attempts: result[1]!, same: result[2] === '是' ? t('query.yes') : t('query.no') })
    : localize(output);
  return (
    <ExampleSection title={t('query.concurrent')}>
      <p className="text-sm text-muted-foreground">{t('query.concurrentHelp')}</p>
      <Button
        className="justify-self-start"
        type="button"
        disabled={pending}
        onClick={() => {
          void read();
        }}
      >
        {t('query.concurrentRead')}
      </Button>
      <p role="status" className="rounded-md bg-muted/40 p-3 text-sm empty:hidden">
        {pending ? t('query.concurrentPending') : outputText}
      </p>
    </ExampleSection>
  );
}

function Infinite({ context, fixture }: SceneProps) {
  const { t } = useFeaturesText();
  const key = [...syntheticKey(context), 'infinite'];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    retry: false,
    queryFn: async ({ signal, pageParam }) => {
      const result = await fixture.get([...key, pageParam], signal, [pageParam * 2 - 1, pageParam * 2]);
      return { ...result, page: pageParam };
    },
    getNextPageParam: last => (last.page < 3 ? last.page + 1 : undefined),
  });
  return (
    <ExampleSection title={t('query.more')}>
      {query.isPending && <p role="status">{t('query.initialLoading')}</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <ul className="my-4 grid gap-2 text-sm [&>li]:rounded-lg [&>li]:bg-muted/40 [&>li]:px-3 [&>li]:py-2">
        {query.data?.pages.flatMap(page =>
          page.value.map(id => <li key={id}>{t('query.moreRow', { context: contextLabel(context), id })}</li>),
        )}
      </ul>
      <Button
        className="justify-self-start"
        type="button"
        disabled={!query.hasNextPage || query.isFetching}
        onClick={() => {
          void query.fetchNextPage();
        }}
      >
        {query.isSuccess && !query.hasNextPage ? t('query.exhausted') : t('query.more')}
      </Button>
    </ExampleSection>
  );
}

function Scenarios(props: SceneProps) {
  const client = useQueryClient();
  const { identity, scope, generation } = props.context;
  const fixture = props.fixture;
  useEffect(
    () => () => {
      const queryKey = syntheticKey({ identity, scope, generation });
      void client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
      fixture.retire(queryKey);
    },
    [client, fixture, identity, scope, generation],
  );
  return (
    <>
      <Pagination {...props} />
      <Retry {...props} />
      <Concurrency {...props} />
      <Infinite {...props} />
    </>
  );
}

export function QueryPage(): React.JSX.Element {
  const { t } = useFeaturesText();
  const [owner] = useState(() => ({
    client: new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
    fixture: createQueryFixture(),
  }));
  const [context, setContext] = useState<SyntheticContext>({
    identity: 'synthetic-reader',
    scope: 'north',
    generation: 0,
  });
  useEffect(
    () => () => {
      void owner.client.cancelQueries();
      owner.client.clear();
      owner.fixture.clear();
    },
    [owner],
  );
  return (
    <ExamplePage title={t('query.title')} description={t('query.intro')}>
      <ExampleSection title={t('query.contextTitle')}>
        <div className="grid min-w-0 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="grid gap-2 text-sm">
            {t('query.identity')}
            <Select
              label={t('query.identity')}
              value={context.identity}
              onValueChange={identity => setContext(value => ({ ...value, identity }))}
              options={['synthetic-reader', 'synthetic-other'].map(value => ({ value, label: value }))}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {t('query.scope')}
            <Select
              label={t('query.scope')}
              value={context.scope}
              onValueChange={scope => setContext(value => ({ ...value, scope }))}
              options={['north', 'south'].map(value => ({ value, label: value }))}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => setContext(value => ({ ...value, generation: value.generation + 1 }))}
          >
            {t('query.generation')}
          </Button>
        </div>
        <p className="mt-4 break-words rounded-lg bg-muted/40 px-3 py-2 text-sm" role="status">
          {t('query.context', { context: contextLabel(context) })}
        </p>
      </ExampleSection>
      <QueryClientProvider client={owner.client}>
        <div className="grid min-w-0 items-start gap-[var(--workspace-section-gap)] xl:grid-cols-2">
          <Scenarios key={JSON.stringify(syntheticKey(context))} context={context} fixture={owner.fixture} />
        </div>
      </QueryClientProvider>
      <ExampleDetails title={t('implementation')}>
        <p>{t('query.help')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}
