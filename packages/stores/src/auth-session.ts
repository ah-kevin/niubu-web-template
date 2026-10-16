import type { AuthAdapter, AuthContext, AuthOperation, AuthUser, BackendMenuItem, ScopeRef } from '@niubu/core-typings';

export type AuthSessionSnapshot<U extends AuthUser> = Readonly<{
  user: U | null;
  status: 'restoring' | 'anonymous' | 'loading' | 'ready' | 'error';
  loginExpired: boolean;
  scope: ScopeRef | null;
  codes: readonly string[];
  menu: readonly BackendMenuItem[];
  generation: number;
  error: unknown;
}>;

export interface AuthSessionOptions<U extends AuthUser, L> {
  adapter: AuthAdapter<U, L, AbortSignal>;
  onIdentityReset(previous: AuthContext): void | Promise<void>;
  onScopeReset(previous: AuthContext): void | Promise<void>;
  reload(href: string): void;
  homeHref: string;
  loginHref: string;
}

export interface AuthSession<U extends AuthUser, L> {
  getSnapshot(): AuthSessionSnapshot<U>;
  subscribe(listener: () => void): () => void;
  restore(): Promise<U | null>;
  login(input: L, returnTo: string, signal?: AbortSignal): Promise<'reloaded' | 'resumed'>;
  logout(): Promise<void>;
  switchScope(scope: ScopeRef | null): Promise<void>;
  refresh(signal: AbortSignal): Promise<void>;
  markLoginExpired(): void;
  requestContext(): Readonly<{ generation: number; signal: AbortSignal }>;
  dispose(): void;
}

function cancellation() {
  return Object.assign(new Error('Authentication operation cancelled'), { name: 'AbortError' });
}

function isCancellation(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

/** Only plain serializable DTOs cross the adapter boundary. Never freeze adapter-owned values. */
function own<T>(value: T): T {
  const copy = structuredClone(value);
  const visited = new WeakSet<object>();
  function freeze(item: unknown) {
    if (!item || typeof item !== 'object' || visited.has(item)) return;
    visited.add(item);
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  }
  freeze(copy);
  return copy;
}

/** Settle cancellation even when an adapter ignores its native signal. Its commits still require assertCurrent. */
function run<T>(op: AuthOperation<AbortSignal>, work: () => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      op.signal.removeEventListener('abort', abort);
      reject(cancellation());
    };
    try {
      op.assertCurrent();
      op.signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(work()).then(
        value => {
          op.signal.removeEventListener('abort', abort);
          try {
            op.assertCurrent();
            resolve(value);
          } catch (error) {
            reject(error);
          }
        },
        error => {
          op.signal.removeEventListener('abort', abort);
          try {
            op.assertCurrent();
            reject(error);
          } catch (cancelled) {
            reject(cancelled);
          }
        },
      );
    } catch (error) {
      op.signal.removeEventListener('abort', abort);
      reject(error);
    }
  });
}

/** A caller-owned in-memory session. Credentials, persistence, URL validation and identity owners belong to the app. */
export function createAuthSession<U extends AuthUser, L>(options: AuthSessionOptions<U, L>): AuthSession<U, L> {
  const { adapter } = options;
  const listeners = new Set<() => void>();
  let disposed = false;
  let grantGeneration: number | null = null;
  let operationController = new AbortController();
  let requestController = new AbortController();
  requestController.abort();
  let snapshot: AuthSessionSnapshot<U> = Object.freeze({
    user: null,
    status: 'restoring',
    loginExpired: false,
    scope: null,
    codes: own([]),
    menu: own([]),
    generation: 0,
    error: null,
  });
  let request = Object.freeze({ generation: snapshot.generation, signal: requestController.signal });

  function assertAlive() {
    if (disposed) throw cancellation();
  }
  function emit() {
    for (const listener of listeners) listener();
  }
  function publish(next: AuthSessionSnapshot<U>) {
    snapshot = Object.freeze(next);
    emit();
  }
  function operation(signal = operationController.signal): AuthOperation<AbortSignal> {
    const generation = snapshot.generation;
    return Object.freeze({
      signal,
      assertCurrent() {
        if (disposed || signal.aborted || snapshot.generation !== generation) throw cancellation();
      },
    });
  }
  function begin(next: Partial<AuthSessionSnapshot<U>>, blockOperation = false, signal?: AbortSignal) {
    assertAlive();
    const previous: AuthContext = Object.freeze({
      identityKey: snapshot.user?.id ?? 'anonymous',
      scope: snapshot.scope,
      generation: snapshot.generation,
    });
    const oldOperation = operationController,
      oldRequest = requestController;
    operationController = new AbortController();
    requestController = new AbortController();
    requestController.abort();
    snapshot = Object.freeze({
      ...snapshot,
      codes: own([]),
      menu: own([]),
      error: null,
      ...next,
      generation: snapshot.generation + 1,
    });
    request = Object.freeze({ generation: snapshot.generation, signal: requestController.signal });
    const op = operation(signal ? AbortSignal.any([operationController.signal, signal]) : operationController.signal);
    if (blockOperation) operationController.abort();
    // Abort listeners already observe revoked grants and the new generation.
    oldOperation.abort();
    oldRequest.abort();
    emit();
    return { previous, op };
  }
  function fail(op: AuthOperation<AbortSignal>, error: unknown): never {
    op.assertCurrent();
    if (isCancellation(error)) throw cancellation();
    const controller = operationController;
    publish({ ...snapshot, status: 'error', codes: own([]), menu: own([]), error });
    controller.abort();
    throw error;
  }
  function checkScope(user: U | null, scope: ScopeRef | null) {
    if (!user) throw new Error('An authenticated user is required');
    if (scope !== null && !user.workspaces.some(item => item.kind === scope.kind && item.id === scope.id)) {
      throw new Error('The requested scope is not a user workspace');
    }
  }
  async function grants(user: U, scope: ScopeRef | null, op: AuthOperation<AbortSignal>) {
    checkScope(user, scope);
    const generation = snapshot.generation;
    grantGeneration = generation;
    try {
      const [codes, menu] = await run(op, () =>
        Promise.all([adapter.getCodes(scope, op).then(own), adapter.getMenu(scope, op).then(own)]),
      );
      op.assertCurrent();
      requestController = new AbortController();
      request = Object.freeze({ generation: snapshot.generation, signal: requestController.signal });
      publish({ ...snapshot, user, status: 'ready', loginExpired: false, scope, codes, menu, error: null });
      op.assertCurrent();
    } finally {
      if (grantGeneration === generation) grantGeneration = null;
    }
  }
  function expire(error: unknown) {
    if (disposed || !snapshot.user || snapshot.loginExpired) return;
    begin({ status: 'error', loginExpired: true, error }, true);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async restore() {
      const hadUser = snapshot.user !== null;
      const { previous, op } = begin({ user: null, scope: null, status: 'restoring', loginExpired: false });
      try {
        if (hadUser) await run(op, () => options.onIdentityReset(previous));
        const restored = await run(op, () => adapter.restore(op));
        const user = restored === null ? null : own(restored);
        op.assertCurrent();
        publish({ ...snapshot, user, status: user ? 'loading' : 'anonymous' });
        op.assertCurrent();
        return user;
      } catch (error) {
        return fail(op, error);
      }
    },
    async login(input, returnTo, signal) {
      const prior = snapshot;
      const { previous, op } = begin({ status: 'loading' }, false, signal);
      try {
        const user = own(await run(op, () => adapter.login(input, op)));
        if (prior.loginExpired && prior.user?.id === user.id) {
          await grants(user, prior.scope, op);
          op.assertCurrent();
          return 'resumed';
        }
        await run(op, () => options.onIdentityReset(previous));
        op.assertCurrent();
        options.reload(returnTo || options.homeHref);
        return 'reloaded';
      } catch (error) {
        return fail(op, error);
      }
    },
    async logout() {
      const { previous, op } = begin({ user: null, scope: null, status: 'anonymous', loginExpired: false });
      const errors: unknown[] = [];
      op.assertCurrent();
      try {
        adapter.invalidateLocal();
      } catch (error) {
        errors.push(error);
      }
      // Both attempts run even if either cleanup fails. Neither may restore grants.
      const outcomes = await run(op, () =>
        Promise.allSettled([run(op, () => adapter.logout(op)), run(op, () => options.onIdentityReset(previous))]),
      );
      op.assertCurrent();
      for (const outcome of outcomes) if (outcome.status === 'rejected') errors.push(outcome.reason);
      const error = errors.length > 1 ? new AggregateError(errors, 'Logout failed') : errors[0];
      if (errors.length) publish({ ...snapshot, error });
      op.assertCurrent();
      options.reload(options.loginHref);
      if (errors.length) throw error;
    },
    async switchScope(scope) {
      const ownedScope = own(scope);
      const { previous, op } = begin({ scope: ownedScope, status: 'loading' });
      try {
        await run(op, () => options.onScopeReset(previous));
        if (snapshot.loginExpired) throw new Error('Login has expired');
        checkScope(snapshot.user, ownedScope);
        await grants(snapshot.user!, ownedScope, op);
      } catch (error) {
        return fail(op, error);
      }
    },
    async refresh(signal) {
      assertAlive();
      const loadingGrants = snapshot.status === 'loading' && grantGeneration === snapshot.generation;
      if ((snapshot.status !== 'ready' && !loadingGrants) || !snapshot.user || snapshot.loginExpired)
        throw cancellation();
      const op = operation(AbortSignal.any([operationController.signal, signal]));
      try {
        await run(op, () => adapter.refresh(op));
        op.assertCurrent();
      } catch (error) {
        op.assertCurrent();
        if (isCancellation(error)) throw cancellation();
        expire(error);
        throw error;
      }
    },
    markLoginExpired() {
      expire(null);
    },
    requestContext: () => request,
    dispose() {
      if (disposed) return;
      disposed = true;
      snapshot = Object.freeze({
        ...snapshot,
        user: null,
        scope: null,
        status: 'anonymous',
        loginExpired: false,
        codes: own([]),
        menu: own([]),
        generation: snapshot.generation + 1,
        error: null,
      });
      const oldRequest = requestController;
      requestController = new AbortController();
      requestController.abort();
      request = Object.freeze({ generation: snapshot.generation, signal: requestController.signal });
      listeners.clear();
      operationController.abort();
      oldRequest.abort();
    },
  };
}
