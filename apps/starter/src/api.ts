import { z } from 'zod';
import type { AuthContext } from '@niubu/types';
import type { RequestClient } from '@niubu/request';
import { createSystemApi } from './system/api';
import { menuSchema } from './auth/schemas';

export function createStarterApi(
  client: RequestClient,
  protectedClient: RequestClient = client,
  options?: { getContext: () => AuthContext | null; getSessionSignal?: () => AbortSignal },
) {
  const getContext = options?.getContext ?? (() => null);
  return {
    system: createSystemApi(protectedClient, getContext),
    getContext,
    health: (signal?: AbortSignal) =>
      client.execute({
        path: '/api/health',
        method: 'GET',
        signal,
        activity: 'background',
        decode: data => z.object({ status: z.literal('ok') }).parse(data),
      }),
    menu: (signal?: AbortSignal) =>
      client.execute({
        path: '/api/menu',
        method: 'GET',
        signal,
        activity: 'background',
        decode: data => menuSchema.parse(data),
      }),
  };
}
export type StarterApi = ReturnType<typeof createStarterApi>;
