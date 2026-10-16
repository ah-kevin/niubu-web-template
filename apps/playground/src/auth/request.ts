import type { RequestClient } from '@niubu/request';

export interface SessionRequestOwner {
  getSnapshot(): { readonly user: unknown; readonly status: string; readonly loginExpired: boolean };
  requestContext(): { readonly generation: number; readonly signal: AbortSignal };
}
/** App binding: scope changes actively cancel fetch; disposing a client is reserved for identity teardown. */
export function createSessionRequest(client: RequestClient, owner: SessionRequestOwner): RequestClient {
  return {
    mode: client.mode,
    execute(spec) {
      const state = owner.getSnapshot();
      if (!state.user || state.loginExpired || state.status !== 'ready')
        return Promise.resolve({ ok: false as const, error: { kind: 'aborted' as const } });
      const context = owner.requestContext();
      const signal = spec.signal ? AbortSignal.any([context.signal, spec.signal]) : context.signal;
      return client.execute({ ...spec, signal });
    },
    dispose: () => client.dispose(),
  };
}
