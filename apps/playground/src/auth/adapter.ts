import type { AuthAdapter, AuthOperation, ScopeRef } from '@niubu/types';
import type { RequestClient, RequestError, RequestSpec } from '@niubu/request';
import { ACCESS_EXPIRED_CODE } from '@niubu/request/protocol';
import { z } from 'zod';
import { codesSchema, loginSchema, menuSchema, tokenSchema, userSchema } from './schemas';
import { AUTH_IDENTITY_HINT_KEY, AUTH_RESTORE_BLOCKED_KEY } from './identity-hint';
import type { LoginInput, PlaygroundUser, TokenPair } from './schemas';

export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const AUTH_KEY = 'playground.auth.v1';
const BLOCKED_KEY = AUTH_RESTORE_BLOCKED_KEY;
const storedSchema = z.object({ version: z.literal(1), tokens: tokenSchema });
type Operation = AuthOperation<AbortSignal>;
export class AuthenticationError extends Error {
  readonly kind: RequestError['kind'];
  readonly code?: string;
  readonly status?: number;
  constructor(error: RequestError) {
    super(`Authentication request failed (${error.kind}${error.code ? `/${error.code}` : ''})`);
    this.kind = error.kind;
    this.code = error.code;
    this.status = error.status;
  }
}
/** An app-owned Bearer example. The generic session never inspects or persists tokens. */
export function createPlaygroundAuthAdapter({ request, storage }: { request: RequestClient; storage: AuthStorage }) {
  let live: TokenPair | null = null;
  let grantRequest = request;
  let revoked: TokenPair | null = null;
  let localBlocked = false;
  let disposed = false;
  let verifiedIdentityKey: string | null = null;
  function assertCurrent(op: Operation) {
    if (disposed) throw new DOMException('Authentication adapter disposed', 'AbortError');
    op.signal.throwIfAborted();
    op.assertCurrent();
  }
  function read(key: string) {
    try {
      return storage.getItem(key);
    } catch (cause) {
      throw new Error('Authentication storage unavailable', { cause });
    }
  }
  function invalidateLocal() {
    revoked = live ?? revoked;
    live = null;
    verifiedIdentityKey = null;
    localBlocked = true;
    const failures: unknown[] = [];
    try {
      storage.setItem(BLOCKED_KEY, '1');
    } catch (error) {
      failures.push(error);
    }
    try {
      storage.removeItem(AUTH_KEY);
    } catch (error) {
      failures.push(error);
    }
    try {
      storage.removeItem(AUTH_IDENTITY_HINT_KEY);
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) throw new AggregateError(failures, 'Unable to invalidate local authentication');
  }
  function commit(tokens: TokenPair, op: Operation, identityKey = verifiedIdentityKey) {
    assertCurrent(op);
    if (!identityKey) throw new Error('An authoritative identity is required');
    // Synchronous persistence and publication: no await may split this commit.
    try {
      storage.setItem(AUTH_KEY, JSON.stringify({ version: 1, tokens }));
      storage.setItem(AUTH_IDENTITY_HINT_KEY, JSON.stringify({ version: 1, identityKey }));
      storage.removeItem(BLOCKED_KEY);
    } catch (cause) {
      try {
        storage.removeItem(AUTH_KEY);
      } catch {
        /* Caller receives a persistence failure; no live publication. */
      }
      throw new Error('Authentication persistence failed', { cause });
    }
    live = { ...tokens };
    verifiedIdentityKey = identityKey;
    revoked = null;
    localBlocked = false;
  }
  const headers = (tokens: TokenPair | null): Record<string, string> =>
    tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {};
  async function execute<T>(
    op: Operation,
    spec: Omit<RequestSpec<T>, 'signal' | 'activity'>,
    transport: RequestClient = request,
  ) {
    assertCurrent(op);
    const outcome = await transport.execute({ ...spec, signal: op.signal, activity: 'background' });
    assertCurrent(op);
    if (!outcome.ok) throw new AuthenticationError(outcome.error);
    return outcome.data;
  }
  function loadUser(tokens: TokenPair, op: Operation) {
    return execute(op, {
      path: '/api/user',
      method: 'GET',
      headers: headers(tokens),
      decode: data => userSchema.parse(data),
    });
  }
  function refreshPair(tokens: TokenPair, op: Operation) {
    return execute(op, {
      path: '/api/auth/refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      decode: data => tokenSchema.parse(data),
    });
  }
  const adapter = {
    async restore(op: Operation) {
      assertCurrent(op);
      if (localBlocked || read(BLOCKED_KEY) === '1') return null;
      const raw = read(AUTH_KEY);
      if (!raw) return null;
      let candidate: TokenPair;
      try {
        candidate = storedSchema.parse(JSON.parse(raw)).tokens;
      } catch {
        invalidateLocal();
        return null;
      }
      try {
        let user: PlaygroundUser;
        try {
          user = await loadUser(candidate, op);
        } catch (error) {
          if (!(error instanceof AuthenticationError && error.status === 401 && error.code === ACCESS_EXPIRED_CODE))
            throw error;
          candidate = await refreshPair(candidate, op);
          user = await loadUser(candidate, op);
        }
        commit(candidate, op, user.id);
        return user;
      } catch (error) {
        assertCurrent(op);
        if (error instanceof AuthenticationError && error.status === 401) {
          invalidateLocal();
          return null;
        }
        throw error;
      }
    },
    async login(input: LoginInput, op: Operation) {
      assertCurrent(op);
      const tokens = await execute(op, {
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginSchema.parse(input)),
        decode: data => tokenSchema.parse(data),
      });
      const user = await loadUser(tokens, op);
      commit(tokens, op, user.id);
      return user;
    },
    async logout(op: Operation) {
      const tokens = revoked ?? live;
      invalidateLocal();
      revoked = null;
      await execute(op, {
        path: '/api/auth/logout',
        method: 'POST',
        headers: { ...headers(tokens), 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens ? { refreshToken: tokens.refreshToken } : {}),
        decode: data => z.null().parse(data),
      });
    },
    async refresh(op: Operation) {
      assertCurrent(op);
      const candidate = live;
      if (!candidate) throw new AuthenticationError({ kind: 'http', status: 401, code: 'UNAUTHENTICATED' });
      commit(await refreshPair(candidate, op), op);
    },
    getCodes(scope: ScopeRef | null, op: Operation) {
      return execute(
        op,
        {
          path: '/api/auth/codes',
          method: 'GET',
          headers: headers(live),
          query: scope ? { scopeKind: scope.kind, scopeId: scope.id } : undefined,
          decode: data => codesSchema.parse(data),
        },
        grantRequest,
      );
    },
    getMenu(scope: ScopeRef | null, op: Operation) {
      return execute(
        op,
        {
          path: '/api/menu',
          method: 'GET',
          headers: headers(live),
          query: scope ? { scopeKind: scope.kind, scopeId: scope.id } : undefined,
          decode: data => menuSchema.parse(data),
        },
        grantRequest,
      );
    },
    credentialsProvider(signal: AbortSignal) {
      if (disposed) throw new DOMException('Authentication adapter disposed', 'AbortError');
      signal.throwIfAborted();
      return { credentials: 'omit' as const, headers: headers(live) };
    },
    bindGrantRequest(transport: RequestClient) {
      if (disposed) throw new DOMException('Authentication adapter disposed', 'AbortError');
      grantRequest = transport;
    },
    invalidateLocal,
    dispose() {
      disposed = true;
      grantRequest = request;
      live = null;
      verifiedIdentityKey = null;
      revoked = null;
    },
  } satisfies AuthAdapter<PlaygroundUser, LoginInput, AbortSignal> & {
    bindGrantRequest(transport: RequestClient): void;
    dispose(): void;
  };
  return adapter;
}
