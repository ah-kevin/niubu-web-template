import { z } from 'zod';
import type { AuthContext } from '@niubu/types';
import { createSystemApi } from './system/api';
import { createTransferApi } from './transfers/api';
import type { RequestClient, RequestSpec } from '@niubu/request';
import { menuSchema } from './auth/schemas';

const healthSchema = z.object({ status: z.literal('ok') });

const echoSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  query: z.array(z.string()),
  headers: z.object({ 'x-demo': z.string().optional() }),
});
export type EchoInput = {
  value: string;
  query?: RequestSpec<unknown>['query'];
};
/** Wire envelopes, HTTP status and cancellation are owned by @niubu/request. */
export function createPlaygroundApi(
  client: RequestClient,
  protectedClient: RequestClient = client,
  options?: { getContext: () => AuthContext | null; getSessionSignal?: () => AbortSignal },
) {
  const getContext = options?.getContext ?? (() => null);
  const system = createSystemApi(protectedClient, getContext);
  const transfers = createTransferApi(protectedClient, getContext, options?.getSessionSignal);
  return {
    system,
    transfers,
    getContext,
    health: (signal?: AbortSignal) =>
      client.execute({
        path: '/api/health',
        method: 'GET',
        signal,
        activity: 'background',
        decode: data => healthSchema.parse(data),
      }),
    menu: (signal?: AbortSignal) =>
      client.execute({
        path: '/api/menu',
        method: 'GET',
        signal,
        activity: 'background',
        decode: data => menuSchema.parse(data),
      }),
    echo: ({ value, query = { query: ['playground'] } }: EchoInput, signal?: AbortSignal) =>
      protectedClient.execute({
        path: '/api/demo/echo',
        method: 'POST',
        signal,
        activity: 'foreground',
        body: JSON.stringify({ value }),
        headers: { 'Content-Type': 'application/json', 'X-Demo': 'playground' },
        query,
        decode: data => echoSchema.parse(data),
      }),
  };
}
export type PlaygroundApi = ReturnType<typeof createPlaygroundApi>;
