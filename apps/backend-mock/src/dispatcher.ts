import { ACCESS_EXPIRED_CODE } from '@niubu/request/protocol';
import { BodyError, parseBody } from './body';
import { MOCK_ONLY_SENTINEL, publicMenu, syntheticAccounts } from './fixtures';
import { createSessionStore } from './session';
import { dispatchSystem, matchSystemRoute } from './system/dispatch';
import { createSystemRepository } from './system/repository';
import { SystemError } from './system/validation';
import { createTransferRepository } from './transfers/repository';
import { dispatchTransfer, matchTransferRoute } from './transfers/dispatch';
import { TransferError } from './transfers/contracts';

export interface MockRequest {
  method: string;
  path: string;
  query?: URLSearchParams | Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface MockJsonResponse {
  kind: 'json';
  status: number;
  headers?: Record<string, string>;
  body: { code: number | string; data: unknown; message: string };
}
export interface MockBinaryResponse {
  kind: 'binary';
  status: number;
  headers?: Record<string, string>;
  body: Uint8Array;
}
export type MockResponse = MockJsonResponse | MockBinaryResponse;

export function failureResponse(status: number, code: string, message: string): MockJsonResponse {
  return { kind: 'json', status, headers: { ...responseHeaders }, body: { code, data: null, message } };
}

const responseHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const methods: Record<string, readonly string[]> = {
  '/api/health': ['GET'],
  '/api/demo/echo': ['GET', 'POST'],
  '/api/auth/login': ['POST'],
  '/api/auth/refresh': ['POST'],
  '/api/auth/logout': ['POST'],
  '/api/user': ['GET'],
  '/api/auth/codes': ['GET'],
  '/api/menu': ['GET'],
};

function header(headers: MockRequest['headers'], name: string): string | undefined {
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return typeof entry?.[1] === 'string' ? entry[1] : undefined;
}

function queryParams(query: MockRequest['query']): URLSearchParams {
  if (query instanceof URLSearchParams) return query;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const part of typeof value === 'string' ? [value] : value) params.append(key, part);
  }
  return params;
}

function success(data: unknown): MockJsonResponse {
  return {
    kind: 'json',
    status: 200,
    headers: { ...responseHeaders },
    body: { code: 0, data: structuredClone(data), message: 'OK' },
  };
}

export function createMockBackend(options: { now?: () => number; randomId?: () => string } = {}) {
  const sessions = createSessionStore(options);
  const system = createSystemRepository();
  const transfers = createTransferRepository({
    now: options.now ?? Date.now,
    randomId: options.randomId ?? (() => crypto.randomUUID()),
  });
  let disposed = false;
  return {
    async dispatch(request: MockRequest): Promise<MockResponse> {
      if (disposed) return failureResponse(503, 'DISPOSED', 'Mock backend is closed');
      const systemRoute = matchSystemRoute(request.path);
      const transferRoute = matchTransferRoute(request.path);
      const allowed =
        systemRoute?.methods ??
        transferRoute?.methods ??
        (Object.hasOwn(methods, request.path) ? methods[request.path] : undefined);
      if (!allowed) return failureResponse(404, 'NOT_FOUND', 'Unknown mock endpoint');
      if (!allowed.includes(request.method)) return failureResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
      try {
        const body =
          !systemRoute && !transferRoute && (request.method === 'POST' || request.method === 'PUT')
            ? parseBody(request.body)
            : {};
        const query = queryParams(request.query);
        const authorization = header(request.headers, 'authorization');
        const hasAuthorization = Object.keys(request.headers ?? {}).some(key => key.toLowerCase() === 'authorization');
        const accessToken = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
        switch (request.path) {
          case '/api/health':
            return success({ status: 'ok', service: MOCK_ONLY_SENTINEL });
          case '/api/demo/echo': {
            const value = request.method === 'POST' ? (body.value ?? null) : query.get('value');
            if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
              return failureResponse(400, 'INVALID_BODY', 'Echo value must be a JSON scalar');
            }
            const demo = header(request.headers, 'x-demo');
            return success({
              value,
              query: query.getAll('query'),
              headers: demo === undefined ? {} : { 'x-demo': demo },
            });
          }
          case '/api/auth/login': {
            const account = syntheticAccounts.find(
              candidate => body.username === candidate.username && body.password === candidate.password,
            );
            if (!account) {
              return failureResponse(401, 'INVALID_LOGIN', 'Invalid synthetic account');
            }
            return success(sessions.issue(account.user.id));
          }
          case '/api/auth/refresh': {
            const tokens = typeof body.refreshToken === 'string' ? sessions.refresh(body.refreshToken) : null;
            return tokens
              ? success(tokens)
              : failureResponse(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
          }
          case '/api/auth/logout':
            sessions.revoke({
              accessToken,
              refreshToken: typeof body.refreshToken === 'string' ? body.refreshToken : undefined,
            });
            return success(null);
        }
        const session = sessions.authenticate(accessToken ?? '');
        if (session.kind === 'expired') return failureResponse(401, ACCESS_EXPIRED_CODE, 'Access token expired');
        if (session.kind !== 'valid') {
          if (request.path === '/api/menu' && !hasAuthorization) {
            if (!validScope(query)) return failureResponse(403, 'UNKNOWN_SCOPE', 'Unknown workspace scope');
            return success(publicMenu);
          }
          return failureResponse(401, 'UNAUTHENTICATED', 'Bearer access token required');
        }
        const account = syntheticAccounts.find(candidate => candidate.user.id === session.userId);
        if (!account) return failureResponse(401, 'UNAUTHENTICATED', 'Unknown synthetic user');
        if (transferRoute) {
          if (
            query.getAll('scopeKind').length !== 1 ||
            query.get('scopeKind') !== 'workspace' ||
            query.getAll('scopeId').length !== 1
          )
            return failureResponse(400, 'INVALID_QUERY', 'Exactly one workspace scope is required');
          const scopeId = query.get('scopeId');
          if (
            (scopeId !== 'north' && scopeId !== 'south') ||
            !account.user.workspaces.some(workspace => workspace.id === scopeId)
          )
            return failureResponse(403, 'UNKNOWN_SCOPE', 'Unknown workspace scope');
          if (!(account.scopes[scopeId].codes as readonly string[]).includes('demo:transfer'))
            return failureResponse(403, 'FORBIDDEN', 'Transfer capability required');
          return dispatchTransfer(transfers, transferRoute, request, {
            identityKey: account.user.id,
            scope: { kind: 'workspace', id: scopeId },
          });
        }
        if (systemRoute) {
          return success(
            dispatchSystem(system, systemRoute, request, query, {
              memberships: account.user.workspaces,
              codesFor: workspace => account.scopes[workspace].codes,
            }),
          );
        }
        if (request.path === '/api/user') return success(account.user);
        if (!validScope(query)) return failureResponse(403, 'UNKNOWN_SCOPE', 'Unknown workspace scope');
        const scopeId = query.get('scopeId') === 'south' ? 'south' : 'north';
        if (!account.user.workspaces.some(workspace => workspace.id === scopeId)) {
          return failureResponse(403, 'UNKNOWN_SCOPE', 'Unknown workspace scope');
        }
        const fixture = account.scopes[scopeId];
        return success(request.path === '/api/menu' ? fixture.menu : fixture.codes);
      } catch (error) {
        if (error instanceof BodyError || error instanceof SystemError || error instanceof TransferError)
          return failureResponse(error.status, error.code, error.message);
        return failureResponse(500, 'INTERNAL_ERROR', 'Mock request failed');
      }
    },
    dispose() {
      disposed = true;
      sessions.dispose();
      system.dispose();
      transfers.dispose();
    },
  };
}
function validScope(query: URLSearchParams) {
  const kinds = query.getAll('scopeKind');
  const ids = query.getAll('scopeId');
  if (kinds.length === 0 && ids.length === 0) return true;
  return (
    kinds.length === 1 && kinds[0] === 'workspace' && ids.length === 1 && (ids[0] === 'north' || ids[0] === 'south')
  );
}
