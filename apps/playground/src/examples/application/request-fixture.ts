import { createAuthSession } from '@niubu/stores';
import { createRequestClient, isAccessExpired } from '@niubu/request';
const user = {
  id: 'synthetic-example',
  name: 'Synthetic Example',
  roles: ['user'],
  workspaces: [{ kind: 'workspace', id: 'north' }],
};
/** Local fixture transport only: no real URL, token, storage or login owner is used. */
export function createRequestExample() {
  const auth = createAuthSession({
    adapter: {
      restore: async () => user,
      login: async () => user,
      logout: async () => {},
      refresh: async () => {
        throw Error('Synthetic refresh failure');
      },
      getCodes: async () => ['example:read'],
      getMenu: async () => [],
      credentialsProvider: () => ({ credentials: 'omit' }),
      invalidateLocal() {},
    },
    onIdentityReset() {},
    onScopeReset() {},
    reload() {},
    homeHref: '/home',
    loginHref: '/login',
  });
  const client = createRequestClient({
    mode: 'enabled',
    baseURL: 'https://synthetic.invalid',
    fetch: async input => {
      const url = new URL(String(input));
      if (url.pathname === '/file')
        return new Response('Synthetic sample\n', {
          headers: { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="sample.txt"' },
        });
      if (url.pathname === '/expired')
        return new Response(JSON.stringify({ code: 'ACCESS_EXPIRED', data: null, message: 'Synthetic expiry' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      return new Response(JSON.stringify({ code: 0, data: url.searchParams.toString(), message: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    credentialsProvider: () => ({ credentials: 'omit' }),
    activityReporter() {},
    errorNormalizer: e => e,
    getGeneration: () => auth.getSnapshot().generation,
    renewal: {
      shouldRenew: isAccessExpired,
      renew: async signal => {
        try {
          await auth.refresh(signal);
          return { ok: true, data: undefined };
        } catch {
          return { ok: false, error: { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' } };
        }
      },
    },
  });
  return {
    auth,
    client,
    async ready() {
      await auth.restore();
      await auth.switchScope(user.workspaces[0]!);
    },
    dispose() {
      client.dispose();
      auth.dispose();
    },
  };
}
