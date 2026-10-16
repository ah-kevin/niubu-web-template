import { expect, it, vi } from 'vitest';
import { fakeClient, spec } from './test-helpers';

it('replaces explicit query keys while preserving unrelated path keys and omitting null values', async () => {
  const { client, fetch } = fakeClient();
  await client.execute({
    ...spec,
    path: 'items?keep=first&tag=old&tag=older&skip=path&empty=path',
    query: { tag: ['a b', 'x&y'], count: 0, active: false, skip: null, missing: undefined, empty: [] },
  });
  expect(fetch.mock.calls[0][0]).toBe(
    'https://controlled.invalid/api/items?keep=first&skip=path&tag=a+b&tag=x%26y&count=0&active=false',
  );
  client.dispose();
});

it('preserves URLSearchParams duplicates, replaces path values and does not mutate caller query', async () => {
  const query = new URLSearchParams('tag=a%2Bb&tag=%E4%B8%AD%E6%96%87&blank=');
  const { client, fetch } = fakeClient();
  await client.execute({ ...spec, path: 'items?keep=yes&tag=old', query });
  expect(fetch.mock.calls[0][0]).toBe(
    'https://controlled.invalid/api/items?keep=yes&tag=a%2Bb&tag=%E4%B8%AD%E6%96%87&blank=',
  );
  expect(query.toString()).toBe('tag=a%2Bb&tag=%E4%B8%AD%E6%96%87&blank=');
  client.dispose();
});

it.each(['https://elsewhere.invalid/items', '//elsewhere.invalid/items'])(
  'never sends caller or provider headers to another origin: %s',
  async path => {
    const { client, fetch } = fakeClient();
    expect(await client.execute({ ...spec, path, headers: { 'X-Demo': 'example' }, query: { a: 1 } })).toEqual({
      ok: false,
      error: { kind: 'protocol' },
    });
    expect(fetch).not.toHaveBeenCalled();
    client.dispose();
  },
);

it.each([
  { authorization: 'caller', 'X-Demo': 'example' },
  new Headers({ authorization: 'caller', 'X-Demo': 'example' }),
  [
    ['authorization', 'caller'],
    ['X-Demo', 'example'],
  ] as [string, string][],
])('merges every HeadersInit shape with case-insensitive provider authority: %j', async headers => {
  const providerHeaders = new Headers({ Authorization: 'provider', 'X-Provider': 'retained' });
  const { client, fetch } = fakeClient({
    credentialsProvider: () => ({ headers: providerHeaders, credentials: 'include' }),
  });
  await client.execute({ ...spec, headers });
  expect(Object.fromEntries(new Headers(fetch.mock.calls[0][1]?.headers))).toEqual({
    authorization: 'provider',
    'x-demo': 'example',
    'x-provider': 'retained',
  });
  expect(fetch.mock.calls[0][1]?.credentials).toBe('include');
  expect(new Headers(headers).get('Authorization')).toBe('caller');
  expect(providerHeaders.get('X-Demo')).toBeNull();
  client.dispose();
});

it.each([null, 'plain body', new URLSearchParams('a=1&a=2'), new Blob(['binary']), new FormData()])(
  'passes native bodies unchanged without adding a JSON encoder: %j',
  async body => {
    const { client, fetch } = fakeClient();
    await client.execute({ ...spec, method: 'POST', body });
    expect(fetch.mock.calls[0][1]?.body).toBe(body);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).has('Content-Type')).toBe(false);
    client.dispose();
  },
);

it.each([
  { payload: { code: 9, data: { reason: 'denied' }, message: 'Denied' }, status: 200, kind: 'http' },
  { payload: { data: 7 }, status: 200, kind: 'protocol' },
])('takes error tracing exclusively from HTTP headers: %j', async ({ payload, status, kind }) => {
  const { client } = fakeClient({
    fetch: vi.fn(async () =>
      Response.json(
        { ...payload, request_id: 'body-request', trace_id: 'body-trace' },
        { status, headers: { 'X-Request-Id': 'header-request', 'X-Trace-Id': 'header-trace' } },
      ),
    ),
  });
  expect(await client.execute(spec)).toMatchObject({
    ok: false,
    error: { kind, status, requestId: 'header-request', traceId: 'header-trace' },
  });
  client.dispose();
});

it('ignores body tracing even if its values are malformed', async () => {
  const { client } = fakeClient({
    fetch: vi.fn(async () => Response.json({ code: 0, data: 7, message: 'ok', request_id: 9, trace_id: {} })),
  });
  expect(await client.execute(spec)).toEqual({ ok: true, data: 7 });
  client.dispose();
});

it.each(['bad-json', 'bad-decode'] as const)('retains HTTP tracing on %s protocol failures', async failure => {
  const headers = { 'X-Request-Id': 'req', 'X-Trace-Id': 'trace' };
  const { client } = fakeClient({
    fetch: vi.fn(async () =>
      failure === 'bad-json'
        ? new Response('{', { headers })
        : Response.json({ code: 0, data: 7, message: 'ok' }, { headers }),
    ),
  });
  expect(
    await client.execute({
      ...spec,
      decode: () => {
        throw Error('invalid payload');
      },
    }),
  ).toMatchObject({
    ok: false,
    error: { kind: 'protocol', status: 200, requestId: 'req', traceId: 'trace', details: expect.any(Error) },
  });
  client.dispose();
});
