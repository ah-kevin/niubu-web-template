import type { MockResponse } from './dispatcher';

/** Test adapters must explicitly reject binary responses before reading a JSON envelope. */
export function readJsonBody(response: MockResponse) {
  if (response.kind !== 'json') throw new Error('Expected a JSON mock response');
  return response.body;
}
