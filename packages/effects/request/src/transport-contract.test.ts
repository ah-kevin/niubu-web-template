import { expect, it, vi } from 'vitest';
import { fakeClient, spec } from './test-helpers';

it('sends caller body, headers and encoded repeated query through the injected fetch', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ code: 0, data: { value: 'hello' }, message: 'ok' }));
  const { client } = fakeClient({ fetch });
  await client.execute({ ...spec, method: 'POST', body: '{"value":"hello"}', headers: { 'Content-Type': 'application/json', 'X-Demo': 'example' }, query: { q: 'a b', tag: ['one', 'two'] } });
  const [url, init] = fetch.mock.calls[0];
  expect(String(url)).toBe('https://controlled.invalid/api/items?q=a+b&tag=one&tag=two');
  expect(init?.body).toBe('{"value":"hello"}');
  expect(new Headers(init?.headers).get('X-Demo')).toBe('example');
  expect(new Headers(init?.headers).get('X-Controlled-Credential')).toBe('fake-only');
  client.dispose();
});

it('accepts the declared code-zero response envelope', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ code: 0, data: 7, message: 'ok' }));
  const { client } = fakeClient({ fetch });
  expect(await client.execute(spec)).toEqual({ ok: true, data: 7 });
  client.dispose();
});

it('rejects the earlier data-only envelope instead of treating it as success', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ data: 7 }));
  const { client } = fakeClient({ fetch });
  expect(await client.execute(spec)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  client.dispose();
});
