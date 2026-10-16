import type { AuthAdapter, AuthContext, AuthOperation, AuthUser, BackendMenuItem } from '@niubu/core-typings';
import { describe, expect, it, vi } from 'vitest';
import { createAuthSession } from './index';

it('loads scope grants atomically and logs out through captured owner cleanup', async () => {
  const user = {
    id: 'demo-user',
    name: 'Demo',
    roles: [],
    workspaces: [
      { kind: 'workspace', id: 'north' },
      { kind: 'workspace', id: 'south' },
    ],
  } as const;
  const reload = vi.fn(),
    identityReset = vi.fn(),
    scopeReset = vi.fn();
  const adapter = {
    restore: async () => user,
    login: async () => user,
    logout: vi.fn(async () => {}),
    refresh: async () => {},
    getCodes: async (scope: { id: string } | null) =>
      scope?.id === 'north' ? ['demo:read', 'demo:echo'] : ['demo:read'],
    getMenu: async () => [{ kind: 'page' as const, id: 'home', pageId: 'playground.home' }],
    credentialsProvider: () => ({ credentials: 'omit' as const }),
    invalidateLocal: vi.fn(),
  };
  const session = createAuthSession({
    adapter,
    onIdentityReset: identityReset,
    onScopeReset: scopeReset,
    reload,
    homeHref: '/home',
    loginHref: '/login',
  });
  await session.restore();
  await session.switchScope({ kind: 'workspace', id: 'north' });
  expect(session.getSnapshot()).toMatchObject({
    user,
    status: 'ready',
    scope: { kind: 'workspace', id: 'north' },
    codes: ['demo:read', 'demo:echo'],
  });
  await session.switchScope({ kind: 'workspace', id: 'south' });
  expect(session.getSnapshot().codes).toEqual(['demo:read']);
  expect(reload).not.toHaveBeenCalled();
  await session.logout();
  expect(adapter.invalidateLocal).toHaveBeenCalled();
  expect(identityReset).toHaveBeenCalledWith(
    expect.objectContaining({ identityKey: 'demo-user', scope: { kind: 'workspace', id: 'south' } }),
  );
  expect(session.getSnapshot()).toMatchObject({ user: null, codes: [], menu: [] });
  expect(reload).toHaveBeenCalledWith('/login');
  session.dispose();
});

const north = { kind: 'workspace', id: 'north' } as const;
const south = { kind: 'workspace', id: 'south' } as const;
const input = { username: 'demo@playground.invalid' };
type Input = typeof input;
const makeUser = (id = 'demo-user'): AuthUser => ({ id, name: 'Demo', roles: ['reader'], workspaces: [north, south] });
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(overrides: Partial<AuthAdapter<AuthUser, Input, AbortSignal>> = {}) {
  const adapter: AuthAdapter<AuthUser, Input, AbortSignal> = {
    restore: async () => makeUser(),
    login: async () => makeUser(),
    logout: async () => {},
    refresh: async () => {},
    getCodes: async scope => (scope?.id === 'north' ? ['demo:read', 'demo:echo'] : ['demo:read']),
    getMenu: async () => [{ kind: 'page', id: 'home', pageId: 'playground.home' }],
    credentialsProvider: () => ({ credentials: 'omit' }),
    invalidateLocal: vi.fn(),
    ...overrides,
  };
  const reload = vi.fn();
  const identityReset = vi.fn<(previous: AuthContext) => void | Promise<void>>();
  const scopeReset = vi.fn<(previous: AuthContext) => void | Promise<void>>();
  const session = createAuthSession({
    adapter,
    onIdentityReset: identityReset,
    onScopeReset: scopeReset,
    reload,
    homeHref: '/home',
    loginHref: '/login',
  });
  return { adapter, session, reload, identityReset, scopeReset };
}
async function ready(overrides: Partial<AuthAdapter<AuthUser, Input, AbortSignal>> = {}) {
  const f = fixture(overrides);
  await f.session.restore();
  await f.session.switchScope(north);
  return f;
}
const cancelled = { name: 'AbortError' };

describe('authoritative startup and immutable ownership', () => {
  it('restores the user only, before owners, grants or reload', async () => {
    const getCodes = vi.fn(async () => []),
      getMenu = vi.fn(async () => []);
    const f = fixture({ getCodes, getMenu });
    expect(f.session.getSnapshot().status).toBe('restoring');
    expect((await f.session.restore())?.id).toBe('demo-user');
    expect(f.session.getSnapshot()).toMatchObject({
      status: 'loading',
      user: makeUser(),
      scope: null,
      codes: [],
      menu: [],
    });
    expect(getCodes).not.toHaveBeenCalled();
    expect(getMenu).not.toHaveBeenCalled();
    expect(f.identityReset).not.toHaveBeenCalled();
    expect(f.reload).not.toHaveBeenCalled();
  });
  it('distinguishes anonymous restore from technical failure', async () => {
    const a = fixture({ restore: async () => null });
    expect(await a.session.restore()).toBeNull();
    expect(a.session.getSnapshot()).toMatchObject({ status: 'anonymous', user: null, codes: [], menu: [] });
    const failure = Error('invalid user DTO');
    const b = fixture({
      restore: async () => {
        throw failure;
      },
    });
    await expect(b.session.restore()).rejects.toBe(failure);
    expect(b.session.getSnapshot()).toMatchObject({ status: 'error', user: null, codes: [], menu: [], error: failure });
    expect(b.reload).not.toHaveBeenCalled();
  });
  it('owns deep frozen copies without freezing adapter user, codes or nested menus', async () => {
    const source = { ...makeUser(), roles: ['reader'], workspaces: [{ kind: 'workspace', id: 'north' }] };
    const codes = ['demo:read'];
    const child = { kind: 'page' as const, id: 'p', pageId: 'original' };
    const menu: BackendMenuItem[] = [{ kind: 'group', id: 'g', title: 'Original', children: [child] }];
    const f = await ready({ restore: async () => source, getCodes: async () => codes, getMenu: async () => menu });
    source.roles.push('admin');
    source.workspaces[0]!.id = 'untrusted';
    codes.push('admin:write');
    child.pageId = 'changed';
    menu.splice(0);
    const s = f.session.getSnapshot();
    expect(s.user?.roles).toEqual(['reader']);
    expect(s.user?.workspaces).toEqual([north]);
    expect(s.codes).toEqual(['demo:read']);
    expect(s.menu).toEqual([
      { kind: 'group', id: 'g', title: 'Original', children: [{ kind: 'page', id: 'p', pageId: 'original' }] },
    ]);
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.user?.workspaces[0])).toBe(true);
    expect(s.menu[0]?.kind === 'group' && Object.isFrozen(s.menu[0].children[0])).toBe(true);
    expect(f.session.getSnapshot()).toBe(s);
    expect(fixture().session.getSnapshot().user).toBeNull();
  });
});

describe('scope grants and cleanup', () => {
  it('revokes and increments before abort, waits for captured cleanup and publishes codes/menu atomically', async () => {
    const f = await ready(),
      old = f.session.requestContext();
    const generation = f.session.getSnapshot().generation;
    const cleanup = deferred<void>(),
      codes = deferred<readonly string[]>(),
      menu = deferred<readonly BackendMenuItem[]>(),
      fetched = deferred<void>();
    const atAbort: unknown[] = [];
    old.signal.addEventListener('abort', () => atAbort.push(f.session.getSnapshot()));
    f.scopeReset.mockImplementationOnce(previous => {
      expect(previous).toEqual({ identityKey: 'demo-user', scope: north, generation });
      expect(Object.isFrozen(previous)).toBe(true);
      return cleanup.promise;
    });
    const getCodes = vi.fn(() => codes.promise);
    f.adapter.getCodes = getCodes;
    f.adapter.getMenu = () => {
      fetched.resolve();
      return menu.promise;
    };
    const switching = f.session.switchScope(south);
    expect(old.signal.aborted).toBe(true);
    expect(atAbort).toEqual([
      expect.objectContaining({ codes: [], menu: [], generation: generation + 1, status: 'loading' }),
    ]);
    expect(getCodes).not.toHaveBeenCalled();
    cleanup.resolve();
    await fetched.promise;
    codes.resolve(['south:read']);
    await codes.promise;
    expect(f.session.getSnapshot().codes).toEqual([]);
    menu.resolve([{ kind: 'page', id: 's', pageId: 'south.page' }]);
    await switching;
    expect(f.session.getSnapshot()).toMatchObject({
      status: 'ready',
      codes: ['south:read'],
      menu: [{ kind: 'page', id: 's', pageId: 'south.page' }],
    });
    expect(f.reload).not.toHaveBeenCalled();
  });
  it.each([
    { kind: 'workspace', id: 'unknown' },
    { kind: 'account', id: 'north' },
  ])('rejects nonmember %j without fallback', async scope => {
    const f = await ready();
    const getCodes = vi.fn(f.adapter.getCodes);
    f.adapter.getCodes = getCodes;
    await expect(f.session.switchScope(scope)).rejects.toThrow();
    expect(f.session.getSnapshot()).toMatchObject({ status: 'error', scope, codes: [], menu: [] });
    expect(getCodes).not.toHaveBeenCalled();
    expect(f.session.requestContext().signal.aborted).toBe(true);
  });
  it('allows null account scope but cannot grant an anonymous session', async () => {
    const f = await ready();
    await f.session.switchScope(null);
    expect(f.session.getSnapshot()).toMatchObject({ status: 'ready', scope: null, codes: ['demo:read'] });
    const a = fixture({ restore: async () => null });
    await a.session.restore();
    await expect(a.session.switchScope(null)).rejects.toThrow();
    expect(a.session.getSnapshot()).toMatchObject({ user: null, codes: [], menu: [] });
  });
  it('never publishes partial grants after fetch or cleanup failure', async () => {
    const f = await ready(),
      failure = Error('menu unavailable');
    f.adapter.getCodes = async () => ['must:not:publish'];
    f.adapter.getMenu = async () => {
      throw failure;
    };
    await expect(f.session.switchScope(south)).rejects.toBe(failure);
    expect(f.session.getSnapshot()).toMatchObject({ status: 'error', codes: [], menu: [], error: failure });
    const getCodes = vi.fn(f.adapter.getCodes);
    f.adapter.getCodes = getCodes;
    f.scopeReset.mockRejectedValueOnce(Error('query teardown failed'));
    await expect(f.session.switchScope(north)).rejects.toThrow('query teardown failed');
    expect(getCodes).not.toHaveBeenCalled();
    expect(f.session.getSnapshot().codes).toEqual([]);
  });
  it('lets the last scope win while late cleanup targets the captured old scope and generation', async () => {
    const f = await ready(),
      generation = f.session.getSnapshot().generation;
    const cleanup = deferred<void>(),
      deleted: AuthContext[] = [];
    f.scopeReset.mockImplementationOnce(async previous => {
      await cleanup.promise;
      deleted.push(previous);
    });
    const old = f.session.switchScope(south),
      rejected = expect(old).rejects.toMatchObject(cancelled);
    await f.session.switchScope(null);
    await rejected;
    const winning = f.session.getSnapshot();
    cleanup.resolve();
    await cleanup.promise;
    expect(deleted).toEqual([{ identityKey: 'demo-user', scope: north, generation }]);
    expect(f.session.getSnapshot()).toBe(winning);
    expect(winning).toMatchObject({ status: 'ready', scope: null });
  });
  it('actively cancels pending scope work without a new request and ignores late grants', async () => {
    const f = await ready(),
      pending = deferred<readonly string[]>(),
      entered = deferred<AuthOperation<AbortSignal>>();
    f.adapter.getCodes = (scope, op) => {
      if (scope?.id === 'south') {
        entered.resolve(op);
        return pending.promise;
      }
      return Promise.resolve(['north:current']);
    };
    const old = f.session.switchScope(south),
      rejected = expect(old).rejects.toMatchObject(cancelled),
      op = await entered.promise;
    await f.session.switchScope(north);
    await rejected;
    expect(op.signal.aborted).toBe(true);
    expect(() => op.assertCurrent()).toThrow(expect.objectContaining(cancelled));
    pending.resolve(['stale:grant']);
    await pending.promise;
    expect(f.session.getSnapshot().codes).toEqual(['north:current']);
  });
});

describe('identity replacement and expiry resume', () => {
  it('cleans anonymous owners before reload without exposing the new identity or loading its grants', async () => {
    const f = fixture({ restore: async () => null });
    await f.session.restore();
    const cleanup = deferred<void>(),
      entered = deferred<void>();
    f.identityReset.mockImplementationOnce(() => {
      entered.resolve();
      return cleanup.promise;
    });
    const getCodes = vi.fn(f.adapter.getCodes);
    f.adapter.getCodes = getCodes;
    const seen: unknown[] = [];
    f.session.subscribe(() => seen.push(f.session.getSnapshot()));
    const login = f.session.login(input, '/registered?scopeKind=workspace&scopeId=north');
    await entered.promise;
    expect(f.reload).not.toHaveBeenCalled();
    cleanup.resolve();
    expect(await login).toBe('reloaded');
    expect(getCodes).not.toHaveBeenCalled();
    expect(seen).not.toContainEqual(expect.objectContaining({ user: expect.objectContaining({ id: 'demo-user' }) }));
    expect(f.identityReset).toHaveBeenCalledWith(expect.objectContaining({ identityKey: 'anonymous', scope: null }));
    expect(f.reload).toHaveBeenCalledWith('/registered?scopeKind=workspace&scopeId=north');
  });
  it('resumes by returned user id, retaining expiry until both current-scope grants finish', async () => {
    const f = await ready();
    f.session.markLoginExpired();
    expect(f.session.getSnapshot()).toMatchObject({ user: makeUser(), loginExpired: true, codes: [], menu: [] });
    expect(f.session.requestContext().signal.aborted).toBe(true);
    const codes = deferred<readonly string[]>(),
      entered = deferred<void>();
    f.adapter.getCodes = () => {
      entered.resolve();
      return codes.promise;
    };
    const login = f.session.login({ username: 'different-input@playground.invalid' }, '/home');
    await entered.promise;
    expect(f.session.getSnapshot()).toMatchObject({ status: 'loading', loginExpired: true, codes: [], menu: [] });
    expect(f.session.requestContext().signal.aborted).toBe(true);
    codes.resolve(['renewed:read']);
    expect(await login).toBe('resumed');
    expect(f.session.getSnapshot()).toMatchObject({
      status: 'ready',
      loginExpired: false,
      scope: north,
      codes: ['renewed:read'],
    });
    expect(f.session.requestContext().signal.aborted).toBe(false);
    expect(f.identityReset).not.toHaveBeenCalled();
    expect(f.reload).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'reloads a different returned identity without publishing it to old owners (expired=%s)',
    async expired => {
      const f = await ready({ login: async () => makeUser('second-user') });
      if (expired) f.session.markLoginExpired();
      const seen: (AuthUser | null)[] = [];
      f.session.subscribe(() => seen.push(f.session.getSnapshot().user));
      expect(await f.session.login(input, '/home')).toBe('reloaded');
      expect(seen.every(value => value?.id !== 'second-user')).toBe(true);
      expect(f.session.getSnapshot().codes).toEqual([]);
      expect(f.identityReset).toHaveBeenCalledWith(expect.objectContaining({ identityKey: 'demo-user', scope: north }));
      expect(f.reload).toHaveBeenCalledWith('/home');
    },
  );
  it('reloads ordinary same-id login but refuses expired resume into a revoked workspace', async () => {
    const ordinary = await ready();
    expect(await ordinary.session.login(input, '/home')).toBe('reloaded');
    const f = await ready({ login: async () => ({ ...makeUser(), workspaces: [south] }) });
    f.session.markLoginExpired();
    await expect(f.session.login(input, '/home')).rejects.toThrow();
    expect(f.session.getSnapshot()).toMatchObject({ loginExpired: true, codes: [], menu: [], scope: north });
    expect(f.reload).not.toHaveBeenCalled();
  });
  it('keeps failed expired login blocked and forbids scope loading as an expiry bypass', async () => {
    const f = await ready({
      login: async () => {
        throw Error('login rejected');
      },
    });
    f.session.markLoginExpired();
    await expect(f.session.login(input, '/home')).rejects.toThrow('login rejected');
    await expect(f.session.switchScope(south)).rejects.toThrow();
    expect(f.session.getSnapshot()).toMatchObject({ loginExpired: true, codes: [], menu: [] });
    expect(f.session.requestContext().signal.aborted).toBe(true);
  });
  it('lets the last login win and stops an ignored-abort adapter from committing', async () => {
    const first = deferred<AuthUser>(),
      entered = deferred<AuthOperation<AbortSignal>>(),
      commits: string[] = [];
    const f = fixture({
      login: async (value, op) => {
        let result: AuthUser;
        if (value.username === 'first') {
          entered.resolve(op);
          result = await first.promise;
        } else result = makeUser('winner');
        op.assertCurrent();
        commits.push(result.id);
        return result;
      },
    });
    const old = f.session.login({ username: 'first' }, '/stale'),
      rejected = expect(old).rejects.toMatchObject(cancelled),
      op = await entered.promise;
    expect(await f.session.login({ username: 'last' }, '/home')).toBe('reloaded');
    await rejected;
    expect(op.signal.aborted).toBe(true);
    first.resolve(makeUser('stale'));
    await first.promise;
    expect(commits).toEqual(['winner']);
    expect(f.reload.mock.calls).toEqual([['/home']]);
  });
  it('propagates identity cleanup failure with no restored grants or reload', async () => {
    const f = await ready();
    f.identityReset.mockRejectedValueOnce(Error('identity cleanup failed'));
    await expect(f.session.login(input, '/home')).rejects.toThrow('identity cleanup failed');
    expect(f.session.getSnapshot()).toMatchObject({ status: 'error', codes: [], menu: [] });
    expect(f.reload).not.toHaveBeenCalled();
  });
});

describe('logout and cancellation', () => {
  it('invalidates synchronously and still cleans and reloads after remote and cleanup failures', async () => {
    const remote = deferred<void>(),
      f = await ready({ logout: () => remote.promise }),
      old = f.session.requestContext();
    f.identityReset.mockRejectedValueOnce(Error('cleanup failed'));
    const logout = f.session.logout(),
      rejected = expect(logout).rejects.toThrow();
    expect(f.adapter.invalidateLocal).toHaveBeenCalledTimes(1);
    expect(old.signal.aborted).toBe(true);
    expect(f.session.getSnapshot()).toMatchObject({ status: 'anonymous', user: null, codes: [], menu: [] });
    remote.reject(Error('remote failed'));
    await rejected;
    expect(f.identityReset).toHaveBeenCalledWith(expect.objectContaining({ identityKey: 'demo-user', scope: north }));
    expect(f.reload).toHaveBeenCalledWith('/login');
    expect(f.session.getSnapshot().error).toBeTruthy();
  });
  it('supports cookie-only credentials and blocks auto-restore after remote logout failure', async () => {
    let blocked = false;
    const adapter: Partial<AuthAdapter<AuthUser, Input, AbortSignal>> = {
      credentialsProvider: () => ({ credentials: 'include' }),
      restore: async () => (blocked ? null : makeUser()),
      invalidateLocal: () => {
        blocked = true;
      },
      logout: async () => {
        throw Error('cookie server unavailable');
      },
    };
    const f = await ready(adapter);
    await expect(f.session.logout()).rejects.toThrow('cookie server unavailable');
    expect(f.reload).toHaveBeenCalledWith('/login');
    const next = fixture(adapter);
    expect(await next.session.restore()).toBeNull();
    expect(next.session.getSnapshot().status).toBe('anonymous');
  });
  it.each(['restore', 'login', 'refresh'] as const)(
    'logout cancels in-flight %s and prevents late adapter commits',
    async kind => {
      const f = await ready(),
        pending = deferred<void>(),
        entered = deferred<AuthOperation<AbortSignal>>(),
        writes: string[] = [];
      const work = async (op: AuthOperation<AbortSignal>) => {
        entered.resolve(op);
        await pending.promise;
        op.assertCurrent();
        writes.push(kind);
      };
      f.adapter.restore = async op => {
        await work(op);
        return makeUser('late');
      };
      f.adapter.login = async (_, op) => {
        await work(op);
        return makeUser('late');
      };
      f.adapter.refresh = work;
      const old =
        kind === 'restore'
          ? f.session.restore()
          : kind === 'login'
            ? f.session.login(input, '/late')
            : f.session.refresh(new AbortController().signal);
      const rejected = expect(old).rejects.toMatchObject(cancelled),
        op = await entered.promise;
      await f.session.logout();
      await rejected;
      expect(op.signal.aborted).toBe(true);
      const snapshot = f.session.getSnapshot();
      pending.resolve();
      await pending.promise;
      expect(writes).toEqual([]);
      expect(f.session.getSnapshot()).toBe(snapshot);
      expect(f.reload.mock.calls).toEqual([['/login']]);
    },
  );
  it('prevents a late old logout from reloading after a newer login', async () => {
    const remote = deferred<void>(),
      entered = deferred<void>();
    const f = await ready({
      logout: () => {
        entered.resolve();
        return remote.promise;
      },
    });
    const old = f.session.logout(),
      rejected = expect(old).rejects.toMatchObject(cancelled);
    await entered.promise;
    await f.session.login(input, '/home');
    await rejected;
    remote.resolve();
    await remote.promise;
    expect(f.reload.mock.calls).toEqual([['/home']]);
  });
  it('disposes pending operations, requests, grants and listeners with no late writes or reload', async () => {
    const pending = deferred<AuthUser>(),
      entered = deferred<AuthOperation<AbortSignal>>(),
      commits: string[] = [];
    const f = await ready({
      login: async (_, op) => {
        entered.resolve(op);
        const value = await pending.promise;
        op.assertCurrent();
        commits.push(value.id);
        return value;
      },
    });
    const changed = vi.fn();
    f.session.subscribe(changed);
    const old = f.session.login(input, '/late'),
      rejected = expect(old).rejects.toMatchObject(cancelled),
      op = await entered.promise;
    f.session.dispose();
    f.session.dispose();
    await rejected;
    changed.mockClear();
    const snapshot = f.session.getSnapshot();
    expect(snapshot).toMatchObject({ user: null, codes: [], menu: [] });
    expect(f.session.requestContext().signal.aborted).toBe(true);
    expect(op.signal.aborted).toBe(true);
    pending.resolve(makeUser('late'));
    await pending.promise;
    f.session.markLoginExpired();
    await expect(f.session.restore()).rejects.toMatchObject(cancelled);
    expect(f.session.getSnapshot()).toBe(snapshot);
    expect(changed).not.toHaveBeenCalled();
    expect(commits).toEqual([]);
    expect(f.reload).not.toHaveBeenCalled();
  });
});

describe('normal refresh exception', () => {
  it('refuses newly started refresh while logout is in flight or after anonymous restore', async () => {
    const remote = deferred<void>(),
      refresh = vi.fn(async () => {});
    const f = await ready({ logout: () => remote.promise, refresh });
    const logout = f.session.logout();
    await expect(f.session.refresh(new AbortController().signal)).rejects.toMatchObject(cancelled);
    expect(refresh).not.toHaveBeenCalled();
    remote.resolve();
    await logout;
    const anonymous = fixture({ restore: async () => null, refresh });
    await anonymous.session.restore();
    await expect(anonymous.session.refresh(new AbortController().signal)).rejects.toMatchObject(cancelled);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('preserves generation, request signal, grants and owners during successful refresh', async () => {
    const pending = deferred<void>(),
      entered = deferred<AuthOperation<AbortSignal>>();
    const f = await ready({
      refresh: op => {
        entered.resolve(op);
        return pending.promise;
      },
    });
    const before = f.session.getSnapshot(),
      request = f.session.requestContext(),
      changed = vi.fn();
    f.session.subscribe(changed);
    const refreshing = f.session.refresh(new AbortController().signal),
      op = await entered.promise;
    expect(op.signal.aborted).toBe(false);
    expect(f.session.getSnapshot()).toBe(before);
    expect(request.signal.aborted).toBe(false);
    pending.resolve();
    await refreshing;
    expect(f.session.getSnapshot()).toBe(before);
    expect(f.session.requestContext()).toEqual(request);
    expect(changed).not.toHaveBeenCalled();
    expect(f.identityReset).not.toHaveBeenCalled();
    expect(f.scopeReset).toHaveBeenCalledTimes(1);
  });
  it('expires genuine refresh failure, retains identity and actively revokes requests and grants', async () => {
    const failure = Error('refresh rejected'),
      f = await ready({
        refresh: async () => {
          throw failure;
        },
      }),
      request = f.session.requestContext();
    await expect(f.session.refresh(new AbortController().signal)).rejects.toBe(failure);
    expect(request.signal.aborted).toBe(true);
    expect(f.session.getSnapshot()).toMatchObject({
      user: makeUser(),
      loginExpired: true,
      codes: [],
      menu: [],
      error: failure,
    });
    expect(f.session.requestContext().signal.aborted).toBe(true);
    expect(f.reload).not.toHaveBeenCalled();
  });
  it('settles caller cancellation immediately without marking expiry or changing the session', async () => {
    const pending = deferred<void>(),
      entered = deferred<void>(),
      f = await ready({
        refresh: () => {
          entered.resolve();
          return pending.promise;
        },
      });
    const controller = new AbortController(),
      before = f.session.getSnapshot(),
      request = f.session.requestContext();
    const work = f.session.refresh(controller.signal),
      rejected = expect(work).rejects.toMatchObject(cancelled);
    await entered.promise;
    controller.abort();
    await rejected;
    pending.reject(Error('late transport error'));
    await expect(pending.promise).rejects.toThrow('late transport error');
    expect(f.session.getSnapshot()).toBe(before);
    expect(request.signal.aborted).toBe(false);
  });
  it('treats adapter AbortError as cancellation and skips pre-aborted refresh', async () => {
    const refresh = vi.fn(async () => {
        throw Object.assign(Error('cancelled'), cancelled);
      }),
      f = await ready({ refresh }),
      before = f.session.getSnapshot();
    await expect(f.session.refresh(new AbortController().signal)).rejects.toMatchObject(cancelled);
    const aborted = new AbortController();
    aborted.abort();
    await expect(f.session.refresh(aborted.signal)).rejects.toMatchObject(cancelled);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(f.session.getSnapshot()).toBe(before);
  });
  it.each(['scope', 'login'] as const)(
    'invalidates old refresh on %s transition without expiring the winner',
    async kind => {
      const pending = deferred<void>(),
        entered = deferred<AuthOperation<AbortSignal>>(),
        writes: string[] = [];
      const f = await ready({
        refresh: async op => {
          entered.resolve(op);
          await pending.promise;
          op.assertCurrent();
          writes.push('stale');
        },
      });
      const old = f.session.refresh(new AbortController().signal),
        rejected = expect(old).rejects.toMatchObject(cancelled),
        op = await entered.promise;
      if (kind === 'scope') await f.session.switchScope(south);
      else await f.session.login(input, '/home');
      await rejected;
      expect(op.signal.aborted).toBe(true);
      const current = f.session.getSnapshot();
      pending.resolve();
      await pending.promise;
      expect(writes).toEqual([]);
      expect(f.session.getSnapshot()).toBe(current);
      expect(current.loginExpired).toBe(false);
    },
  );
});

describe('lifecycle completion boundaries', () => {
  it('does not return a restored identity to a caller after a subscriber disposes the owner', async () => {
    const f = fixture();
    f.session.subscribe(() => {
      if (f.session.getSnapshot().user) f.session.dispose();
    });
    await expect(f.session.restore()).rejects.toMatchObject(cancelled);
    expect(f.session.getSnapshot()).toMatchObject({ user: null, codes: [], menu: [] });
  });
  it.each(['restore', 'refresh', 'scope'] as const)(
    'dispose promptly cancels pending %s even if the adapter ignores abort',
    async kind => {
      const f = await ready(),
        pending = deferred<void>(),
        entered = deferred<AuthOperation<AbortSignal>>(),
        commits: string[] = [];
      const work = async (op: AuthOperation<AbortSignal>) => {
        entered.resolve(op);
        await pending.promise;
        op.assertCurrent();
        commits.push(kind);
      };
      f.adapter.restore = async op => {
        await work(op);
        return makeUser('late');
      };
      f.adapter.refresh = work;
      f.adapter.getCodes = async (_, op) => {
        await work(op);
        return ['late:grant'];
      };
      const old =
        kind === 'restore'
          ? f.session.restore()
          : kind === 'refresh'
            ? f.session.refresh(new AbortController().signal)
            : f.session.switchScope(south);
      const rejected = expect(old).rejects.toMatchObject(cancelled),
        op = await entered.promise;
      f.session.dispose();
      await rejected;
      expect(op.signal.aborted).toBe(true);
      const snapshot = f.session.getSnapshot();
      pending.resolve();
      await pending.promise;
      expect(commits).toEqual([]);
      expect(f.session.getSnapshot()).toBe(snapshot);
      expect(f.reload).not.toHaveBeenCalled();
    },
  );
  it('keeps the newest authoritative restore and cancels the older ignored-abort result', async () => {
    const first = deferred<AuthUser>(),
      entered = deferred<AuthOperation<AbortSignal>>();
    const f = fixture();
    let calls = 0;
    f.adapter.restore = op => {
      if (++calls === 1) {
        entered.resolve(op);
        return first.promise;
      }
      return Promise.resolve(makeUser('current'));
    };
    const old = f.session.restore(),
      rejected = expect(old).rejects.toMatchObject(cancelled),
      op = await entered.promise;
    expect((await f.session.restore())?.id).toBe('current');
    await rejected;
    expect(op.signal.aborted).toBe(true);
    first.resolve(makeUser('stale'));
    await first.promise;
    expect(f.session.getSnapshot().user?.id).toBe('current');
    expect(f.reload).not.toHaveBeenCalled();
  });
  it('still clears identity owners and reloads after synchronous local invalidation fails', async () => {
    const f = await ready({
      invalidateLocal: () => {
        throw Error('local persistence unavailable');
      },
    });
    await expect(f.session.logout()).rejects.toThrow('local persistence unavailable');
    expect(f.identityReset).toHaveBeenCalledWith(expect.objectContaining({ identityKey: 'demo-user', scope: north }));
    expect(f.reload).toHaveBeenCalledWith('/login');
    expect(f.session.getSnapshot()).toMatchObject({ user: null, codes: [], menu: [] });
  });
  it('cancels a scope completion if its ready subscriber disposes the owner', async () => {
    const f = await ready();
    f.session.subscribe(() => {
      if (f.session.getSnapshot().status === 'ready') f.session.dispose();
    });
    await expect(f.session.switchScope(south)).rejects.toMatchObject(cancelled);
    expect(f.session.getSnapshot()).toMatchObject({ user: null, codes: [], menu: [] });
  });
  it('cannot abort a reentrant new login started by an expiry subscriber', async () => {
    const entered = deferred<AuthOperation<AbortSignal>>(),
      pending = deferred<AuthUser>();
    const f = await ready({
      login: (_, op) => {
        entered.resolve(op);
        return pending.promise;
      },
    });
    let login: Promise<'resumed' | 'reloaded'> | undefined;
    const unsubscribe = f.session.subscribe(() => {
      if (f.session.getSnapshot().loginExpired && !login) {
        unsubscribe();
        login = f.session.login(input, '/home');
      }
    });
    expect(() => f.session.markLoginExpired()).not.toThrow();
    const op = await entered.promise;
    expect(op.signal.aborted).toBe(false);
    pending.resolve(makeUser());
    expect(await login).toBe('resumed');
    expect(f.session.getSnapshot().status).toBe('ready');
  });
});
