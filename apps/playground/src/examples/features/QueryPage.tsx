import { Button } from '@niubu/shadcn-ui/button';
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
    <section aria-label={t('query.pagination')}>
      <h2>{t('query.pagination')}</h2>
      <p>{t('query.page', { page })}</p>
      {query.isPlaceholderData && <p role="status">{t('query.previousData')}</p>}
      {query.isPending && <p role="status">{t('query.loadingPage')}</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <ul>
        {query.data?.value.map(id => (
          <li key={id}>{t('query.pageRow', { context: contextLabel(context), page: fulfilledPage, id })}</li>
        ))}
      </ul>
      <Button type="button" disabled={page === 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>
        {t('query.previous')}
      </Button>
      <Button type="button" disabled={page === 3 || query.isFetching} onClick={() => setPage(value => value + 1)}>
        {t('query.next')}
      </Button>
    </section>
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
    <section aria-label={t('query.retry')}>
      <h2>{t('query.retry')}</h2>
      <p>{t('query.retryHelp')}</p>
      <Button
        type="button"
        disabled={query.isFetching}
        onClick={() => setScenario(value => ({ failure: 'once', run: value.run + 1 }))}
      >
        {t('query.retryOnce')}
      </Button>
      <Button
        type="button"
        disabled={query.isFetching}
        onClick={() => setScenario(value => ({ failure: 'always', run: value.run + 1 }))}
      >
        {t('query.fail')}
      </Button>
      {query.isFetching && <p role="status">{t('query.runningGet')}</p>}
      {query.data && (
        <p role="status">{t('query.attempts', { value: query.data.value, attempts: query.data.attempts })}</p>
      )}
      {query.error && <p role="alert">{query.error.message}</p>}
    </section>
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
    <section aria-label={t('query.concurrent')}>
      <h2>{t('query.concurrent')}</h2>
      <p>{t('query.concurrentHelp')}</p>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          void read();
        }}
      >
        {t('query.concurrentRead')}
      </Button>
      <p role="status">{pending ? t('query.concurrentPending') : outputText}</p>
    </section>
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
    <section aria-label={t('query.more')}>
      <h2>{t('query.more')}</h2>
      {query.isPending && <p role="status">{t('query.initialLoading')}</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <ul>
        {query.data?.pages.flatMap(page =>
          page.value.map(id => <li key={id}>{t('query.moreRow', { context: contextLabel(context), id })}</li>),
        )}
      </ul>
      <Button
        type="button"
        disabled={!query.hasNextPage || query.isFetching}
        onClick={() => {
          void query.fetchNextPage();
        }}
      >
        {query.isSuccess && !query.hasNextPage ? t('query.exhausted') : t('query.more')}
      </Button>
    </section>
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
    <div className="playground-page example-page feature-example-page">
      <h1>{t('query.title')}</h1>
      <p>{t('query.help')}</p>
      <label>
        {t('query.identity')}
        <select
          value={context.identity}
          onChange={event => setContext(value => ({ ...value, identity: event.target.value }))}
        >
          <option>synthetic-reader</option>
          <option>synthetic-other</option>
        </select>
      </label>
      <label>
        {t('query.scope')}
        <select
          value={context.scope}
          onChange={event => setContext(value => ({ ...value, scope: event.target.value }))}
        >
          <option>north</option>
          <option>south</option>
        </select>
      </label>
      <Button type="button" onClick={() => setContext(value => ({ ...value, generation: value.generation + 1 }))}>
        {t('query.generation')}
      </Button>
      <p>{t('query.context', { context: contextLabel(context) })}</p>
      <QueryClientProvider client={owner.client}>
        <Scenarios key={JSON.stringify(syntheticKey(context))} context={context} fixture={owner.fixture} />
      </QueryClientProvider>
    </div>
  );
}
