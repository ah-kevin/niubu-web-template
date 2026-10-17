import type { AuthContext } from '@niubu/types';
import type { RequestClient, RequestError, RequestOutcome, RequestSpec } from '@niubu/request';
import {
  systemId,
  parseSystemInput,
  parseSystemPage,
  parseSystemQuery,
  parseSystemRecord,
  parseSystemTree,
} from './schemas';
import type { ResourceKind, SystemApi, SystemCrudPort, SystemTreePort, TreeResource } from './contracts';

const aborted = (): RequestOutcome<never> => ({ ok: false, error: { kind: 'aborted' } });
const ownContext = (value: AuthContext): AuthContext =>
  Object.freeze({
    identityKey: value.identityKey,
    generation: value.generation,
    scope: value.scope ? Object.freeze({ kind: value.scope.kind, id: value.scope.id }) : null,
  });
function same(a: AuthContext, b: AuthContext | null) {
  return (
    b !== null &&
    a.identityKey === b.identityKey &&
    a.generation === b.generation &&
    a.scope?.kind === b.scope?.kind &&
    a.scope?.id === b.scope?.id
  );
}
export function createSystemApi(client: RequestClient, getContext: () => AuthContext | null): SystemApi {
  async function send<T>(
    context: AuthContext,
    signal: AbortSignal | undefined,
    build: (captured: AuthContext) => Omit<RequestSpec<T>, 'signal' | 'activity'>,
  ): Promise<RequestOutcome<T>> {
    const captured = ownContext(context);
    const active = () =>
      !signal?.aborted &&
      captured.scope?.kind === 'workspace' &&
      Boolean(captured.scope.id) &&
      same(captured, getContext());
    if (!active()) return aborted();
    let spec: Omit<RequestSpec<T>, 'signal' | 'activity'>;
    try {
      spec = build(captured);
    } catch {
      return { ok: false, error: { kind: 'protocol', message: 'Invalid system request' } };
    }
    const outcome = await client.execute({
      ...spec,
      signal,
      activity: spec.method === 'GET' ? 'background' : 'foreground',
    });
    return active() ? outcome : aborted();
  }
  function port<K extends ResourceKind>(kind: K): SystemCrudPort<K> {
    const base = `/api/system/${kind}`;
    const scope = (context: AuthContext) => ({ scopeKind: context.scope!.kind, scopeId: context.scope!.id });
    const path = (id: string) => `${base}/${encodeURIComponent(systemId.parse(id))}`;
    const decodeRecord = (data: unknown, id?: string) => {
      const record = parseSystemRecord(kind, data);
      if (id !== undefined && record.id !== id) throw new Error('System record identity mismatch');
      return record;
    };
    return {
      list: (context, query, signal) =>
        send(context, signal, captured => {
          const parsed = parseSystemQuery(kind, query);
          const encoded: Record<string, string | number | boolean> = { ...scope(captured) };
          for (const [key, value] of Object.entries(parsed)) {
            if (value === undefined) continue;
            if (value === null && key === 'parentId') encoded[key] = 'null';
            else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
              encoded[key] = value;
            else throw new Error('Invalid scalar system query');
          }
          return { path: base, method: 'GET', query: encoded, decode: data => parseSystemPage(kind, data) };
        }),
      get: (context, id, signal) =>
        send(context, signal, captured => ({
          path: path(id),
          method: 'GET',
          query: scope(captured),
          decode: data => decodeRecord(data, id),
        })),
      create: (context, input, signal) =>
        send(context, signal, captured => ({
          path: base,
          method: 'POST',
          query: scope(captured),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parseSystemInput(kind, input)),
          decode: data => decodeRecord(data),
        })),
      update: (context, id, input, signal) =>
        send(context, signal, captured => ({
          path: path(id),
          method: 'PUT',
          query: scope(captured),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parseSystemInput(kind, input)),
          decode: data => decodeRecord(data, id),
        })),
      remove: (context, id, signal) =>
        send(context, signal, captured => ({
          path: path(id),
          method: 'DELETE',
          query: scope(captured),
          decode: data => {
            const record = systemId.parse(
              typeof data === 'object' && data !== null && 'id' in data ? data.id : undefined,
            );
            if (record !== id) throw new Error('Deleted record identity mismatch');
            return { id: record };
          },
        })),
    };
  }
  function treePort<K extends TreeResource>(kind: K): SystemCrudPort<K> & SystemTreePort<K> {
    return {
      ...port(kind),
      tree: (context, signal) =>
        send(context, signal, captured => ({
          path: `/api/system/${kind}`,
          method: 'GET',
          query: { scopeKind: captured.scope!.kind, scopeId: captured.scope!.id, mode: 'tree' },
          decode: data => parseSystemTree(kind, data),
        })),
    };
  }
  return Object.freeze({
    users: port('users'),
    roles: port('roles'),
    menus: treePort('menus'),
    departments: treePort('departments'),
  });
}
export class SystemRequestError extends Error {
  readonly requestError: RequestError;
  constructor(error: RequestError) {
    super(error.message ?? `System request failed (${error.code ?? error.kind})`);
    this.requestError = error;
  }
}
export function unwrapSystemResult<T>(result: RequestOutcome<T>): T {
  if (result.ok) return result.data;
  if (result.error.kind === 'aborted') throw new DOMException('System operation cancelled', 'AbortError');
  throw new SystemRequestError(result.error);
}
