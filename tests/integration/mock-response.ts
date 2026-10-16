import type { MockResponse } from '../../apps/backend-mock/src/dispatcher';

/** The injected fetch boundary uses the same discriminant as the real Nitro sender. */
export function mockFetchResponse(response: MockResponse): Response {
  const body = response.kind === 'binary' ? new Uint8Array(response.body).buffer : JSON.stringify(response.body);
  return new Response(body, { status: response.status, headers: response.headers });
}
