import { readJsonBody as jsonBody } from './test-response';
import { describe, expect, it } from 'vitest';
import { ACCESS_EXPIRED_CODE } from '@niubu/request/protocol';
import { createMockBackend } from './dispatcher';
import type { MockRequest, MockResponse } from './dispatcher';

type Tokens = { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
const expectedExamplesMenu = {kind:'group',id:'playground-examples',title:'Playground Examples',order:16,children:[
  {kind:'page',id:'example-forms',pageId:'playground.examples.forms'},
  {kind:'page',id:'example-tables',pageId:'playground.examples.tables'},
  {kind:'page',id:'example-components',pageId:'playground.examples.components'},
  {kind:'page',id:'example-feedback',pageId:'playground.examples.feedback'},
  {kind:'page',id:'example-access',pageId:'playground.examples.access'},
  {kind:'page',id:'example-navigation',pageId:'playground.examples.navigation'},
  {kind:'page',id:'example-browser',pageId:'playground.examples.browser'},
  {kind:'page',id:'example-requests',pageId:'playground.examples.requests'},
  {kind:'page',id:'example-query',pageId:'playground.examples.query'},
  {kind:'page',id:'example-preferences',pageId:'playground.examples.preferences'},
  {kind:'page',id:'example-tabs',pageId:'playground.examples.tabs'},
  {kind:'page',id:'example-tab-detail',pageId:'playground.examples.tab-detail',hidden:true},
  {kind:'page',id:'example-navigation-second',pageId:'playground.examples.navigation-second',hidden:true},
  {kind:'page',id:'example-navigation-third',pageId:'playground.examples.navigation-third',hidden:true},
  {kind:'page',id:'example-navigation-deep',pageId:'playground.examples.navigation-deep',hidden:true},
  {kind:'page',id:'example-navigation-detail',pageId:'playground.examples.navigation-detail',hidden:true},
]} as const;

const loginRequest: MockRequest = {
  method: 'POST',
  path: '/api/auth/login',
  body: { username: 'demo@playground.invalid', password: 'demo-only' },
};
const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });
async function login(backend: ReturnType<typeof createMockBackend>, username = 'demo@playground.invalid') {
  const response = await backend.dispatch({ ...loginRequest, body: { username, password: 'demo-only' } });
  expect(response.status).toBe(200);
  return jsonBody(response).data as Tokens;
}
function failure(response: MockResponse, status: number, code: string) {
  expect(response).toMatchObject({ status, body: { code, data: null, message: expect.any(String) } });
}

describe('mock backend public contract', () => {
  it('returns a complete health envelope', async () => {
    expect(await createMockBackend().dispatch({ method: 'GET', path: '/api/health' })).toMatchObject({
      status: 200,
      body: { code: 0, data: { status: 'ok' }, message: expect.any(String) },
    });
  });
  it('exposes only registered public menu ids before login', async () => {
    expect(jsonBody((await createMockBackend().dispatch({ method: 'GET', path: '/api/menu' }))).data).toEqual([
      { kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' },
    ]);
  });
  it.each(['GET', 'POST'])('echo %s allows only value/query/X-Demo', async method => {
    const response = await createMockBackend().dispatch({
      method,
      path: '/api/demo/echo',
      query: new URLSearchParams('value=url&query=one&query=two&secret=hidden'),
      body: method === 'POST' ? { value: 'body', password: 'hidden' } : undefined,
      headers: { 'X-Demo': 'example', Authorization: 'hidden', Cookie: 'hidden', 'X-Secret': 'hidden' },
    });
    expect(response).toMatchObject({
      status: 200,
      body: {
        code: 0,
        data: {
          value: method === 'POST' ? 'body' : 'url',
          query: ['one', 'two'],
          headers: { 'x-demo': 'example' },
        },
        message: expect.any(String),
      },
    });
    expect(JSON.stringify(response)).not.toContain('hidden');
  });
  it.each([
    ['POST', '/api/demo/echo', '{', 400, 'INVALID_JSON'],
    ['POST', '/api/demo/echo', '[]', 400, 'INVALID_BODY'],
    ['POST', '/api/demo/echo', null, 400, 'INVALID_BODY'],
    ['POST', '/api/demo/echo', { value: {} }, 400, 'INVALID_BODY'],
    ['POST', '/api/demo/echo', JSON.stringify({ value: '中'.repeat(23_000) }), 413, 'BODY_TOO_LARGE'],
    ['POST', '/api/demo/echo', { value: 'a'.repeat(65_536) }, 413, 'BODY_TOO_LARGE'],
    ['GET', '/api/missing', undefined, 404, 'NOT_FOUND'],
    ['DELETE', '/api/health', undefined, 405, 'METHOD_NOT_ALLOWED'],
  ])('rejects invalid input case %#', async (method, path, body, status, code) => {
    failure(await createMockBackend().dispatch({ method, path, body }), status, code);
  });
  it('accepts JSON text without exposing extra body fields', async () => {
    const response = await createMockBackend().dispatch({
      method: 'POST',
      path: '/api/demo/echo',
      body: '{"value":"ok","password":"hidden"}',
    });
    expect(jsonBody(response).data).toEqual({ value: 'ok', query: [], headers: {} });
  });
});

describe('mock sessions and scope', () => {
  it.each([
    undefined,
    {},
    { username: 'demo@playground.invalid', password: 'wrong' },
    { username: 'second@playground.invalid', password: 'wrong' },
    { username: 'demo', password: 'demo-only' },
    { username: 'DEMO@playground.invalid', password: 'demo-only' },
    { username: ' demo@playground.invalid ', password: 'demo-only' },
    { username: {}, password: 'demo-only' },
  ])('rejects invalid login without expiry code', async body => {
    failure(
      await createMockBackend().dispatch({ ...loginRequest, body }),
      body === undefined ? 400 : 401,
      body === undefined ? 'INVALID_BODY' : 'INVALID_LOGIN',
    );
  });
  it.each(['/api/user', '/api/auth/codes'])('requires login for %s', async path => {
    failure(await createMockBackend().dispatch({ method: 'GET', path }), 401, 'UNAUTHENTICATED');
  });
  it('isolates tokens and returns synthetic workspace memberships', async () => {
    const a = createMockBackend();
    const b = createMockBackend();
    const token = await login(a);
    expect(token).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 300,
      refreshToken: expect.any(String),
      accessToken: expect.any(String),
    });
    const request = { method: 'GET', path: '/api/user', headers: auth(token.accessToken) };
    expect(jsonBody((await a.dispatch(request))).data).toEqual({
      id: 'demo-user',
      name: 'Demo User',
      roles: ['admin'],
      workspaces: [
        { kind: 'workspace', id: 'north', name: 'North' },
        { kind: 'workspace', id: 'south', name: 'South' },
      ],
    });
    failure(await b.dispatch(request), 401, 'UNAUTHENTICATED');
    failure(
      await b.dispatch({ method: 'POST', path: '/api/auth/refresh', body: { refreshToken: token.refreshToken } }),
      401,
      'INVALID_REFRESH',
    );
  });
  it.each(['demo@playground.invalid', 'second@playground.invalid'])(
    'expires access exactly at the boundary and refreshes with a reusable refresh token for %s',
    async username => {
      let time = 1_000;
      let sequence = 0;
      const backend = createMockBackend({ now: () => time, randomId: () => String(++sequence) });
      const first = await login(backend, username);
      const user = (accessToken: string) =>
        backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(accessToken) });
      time += 299_999;
      expect((await user(first.accessToken)).status).toBe(200);
      time++;
      failure(await user(first.accessToken), 401, ACCESS_EXPIRED_CODE);
      const refresh = () =>
        backend.dispatch({ method: 'POST', path: '/api/auth/refresh', body: { refreshToken: first.refreshToken } });
      const second = jsonBody((await refresh())).data as Tokens;
      expect(second.refreshToken).toBe(first.refreshToken);
      expect(second.accessToken).not.toBe(first.accessToken);
      expect((await user(second.accessToken)).status).toBe(200);
      expect((await refresh()).status).toBe(200);
      time = 1_000 + 7 * 24 * 60 * 60 * 1_000;
      failure(await refresh(), 401, 'INVALID_REFRESH');
    },
  );
  it.each([
    ['demo@playground.invalid', 'access'],
    ['demo@playground.invalid', 'refresh'],
    ['second@playground.invalid', 'access'],
    ['second@playground.invalid', 'refresh'],
  ])('logout for %s by %s revokes both tokens', async (username, by) => {
    const backend = createMockBackend();
    const token = await login(backend, username);
    expect(
      (
        await backend.dispatch({
          method: 'POST',
          path: '/api/auth/logout',
          headers: by === 'access' ? auth(token.accessToken) : undefined,
          body: by === 'refresh' ? { refreshToken: token.refreshToken } : {},
        })
      ).body,
    ).toEqual({ code: 0, data: null, message: expect.any(String) });
    failure(
      await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(token.accessToken) }),
      401,
      'UNAUTHENTICATED',
    );
    failure(
      await backend.dispatch({ method: 'POST', path: '/api/auth/refresh', body: { refreshToken: token.refreshToken } }),
      401,
      'INVALID_REFRESH',
    );
  });
  it('selects grouped pages and safe external/iframe entries only for demo north', async () => {
    const backend = createMockBackend();
    const { accessToken } = await login(backend);
    for (const [id, pages, codes] of [
      [
        'north',
        [
          {
            kind: 'group',
            id: 'workspace-pages',
            title: 'Workspace',
            order: 10,
            children: [
              { kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' },
              { kind: 'page', id: 'request', pageId: 'playground.request', icon: 'arrow-right-left', badge: 'Demo' },
            ],
          },
          {
            kind: 'group',
            id: 'system',
            title: 'System',
            order: 15,
            children: [
              { kind: 'page', id: 'system-users', pageId: 'playground.system.users' },
              { kind: 'page', id: 'system-roles', pageId: 'playground.system.roles' },
              { kind: 'page', id: 'system-menus', pageId: 'playground.system.menus' },
              { kind: 'page', id: 'system-departments', pageId: 'playground.system.departments' },
            ],
          },
          expectedExamplesMenu,
          {
            kind: 'external',
            id: 'documentation',
            title: 'Documentation',
            href: 'https://example.com/docs',
            icon: 'external-link',
            order: 20,
            openInNewWindow: true,
          },
          {
            kind: 'iframe',
            id: 'frame-demo',
            title: 'Embedded demo',
            src: '/frame-demo.html',
            icon: 'monitor',
            order: 30,
          },
          { kind: 'page', id: 'unknown-demo', pageId: 'unknown.page', title: 'Unknown page demo', order: 40 },
          {kind:'page',id:'profile',pageId:'playground.profile',hidden:true},
        ],
        [
          'demo:read',
          'demo:echo',
          'demo:transfer',
          'system:users:read',
          'system:roles:read',
          'system:menus:read',
          'system:departments:read',
          'system:users:write',
          'system:roles:write',
          'system:menus:write',
          'system:departments:write',
        ],
      ],
      ['south', [{ kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' },expectedExamplesMenu,{kind:'page',id:'profile',pageId:'playground.profile',hidden:true}], ['demo:read']],
    ] as const) {
      const request = { method: 'GET', query: { scopeKind: 'workspace', scopeId: id }, headers: auth(accessToken) };
      expect(jsonBody((await backend.dispatch({ ...request, path: '/api/menu' }))).data).toEqual(pages);
      expect(jsonBody((await backend.dispatch({ ...request, path: '/api/auth/codes' }))).data).toEqual(codes);
    }
  });
  it('resolves the second authoritative identity and reduced grants without changing the first session', async () => {
    const backend = createMockBackend();
    const first = await login(backend);
    const second = await login(backend, 'second@playground.invalid');
    const request = { method: 'GET', headers: auth(second.accessToken) };
    expect(jsonBody((await backend.dispatch({ ...request, path: '/api/user' }))).data).toEqual({
      id: 'second-user',
      name: 'Second User',
      roles: ['viewer'],
      workspaces: [
        { kind: 'workspace', id: 'north', name: 'North' },
        { kind: 'workspace', id: 'south', name: 'South' },
      ],
    });
    for (const scopeId of ['north', 'south']) {
      const query = { scopeKind: 'workspace', scopeId };
      expect(jsonBody((await backend.dispatch({ ...request, path: '/api/auth/codes', query }))).data).toEqual(
        scopeId === 'north'
          ? ['demo:read', 'system:users:read', 'system:roles:read', 'system:menus:read', 'system:departments:read']
          : ['demo:read'],
      );
      expect(jsonBody((await backend.dispatch({ ...request, path: '/api/menu', query }))).data).toEqual(
        scopeId === 'north'
          ? [
              {
                kind: 'group',
                id: 'workspace-pages',
                title: 'Workspace',
                order: 10,
                children: [{ kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' }],
              },
              {
                kind: 'group',
                id: 'system',
                title: 'System',
                order: 15,
                children: [
                  { kind: 'page', id: 'system-users', pageId: 'playground.system.users' },
                  { kind: 'page', id: 'system-roles', pageId: 'playground.system.roles' },
                  { kind: 'page', id: 'system-menus', pageId: 'playground.system.menus' },
                  { kind: 'page', id: 'system-departments', pageId: 'playground.system.departments' },
                ],
              },
              expectedExamplesMenu,
              {kind:'page',id:'profile',pageId:'playground.profile',hidden:true},
            ]
          : [{ kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' },expectedExamplesMenu,{kind:'page',id:'profile',pageId:'playground.profile',hidden:true}],
      );
    }
    expect(
      jsonBody((await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(first.accessToken) }))).data,
    ).toMatchObject({ id: 'demo-user', roles: ['admin'] });
    const refreshed = await backend.dispatch({
      method: 'POST',
      path: '/api/auth/refresh',
      body: { refreshToken: second.refreshToken },
    });
    expect(refreshed).toMatchObject({
      status: 200,
      body: { code: 0, data: { refreshToken: second.refreshToken, tokenType: 'Bearer', expiresIn: 300 } },
    });
    const pair = jsonBody(refreshed).data as Tokens;
    expect(pair.accessToken).not.toBe(second.accessToken);
    expect(
      jsonBody((await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(pair.accessToken) }))).data,
    ).toMatchObject({ id: 'second-user', roles: ['viewer'] });
    failure(await backend.dispatch({ ...request, path: '/api/user' }), 401, 'UNAUTHENTICATED');
  });
  it.each(['north', 'south'])('never expands the anonymous menu for %s', async scopeId => {
    const response = await createMockBackend().dispatch({
      method: 'GET',
      path: '/api/menu',
      query: { scopeKind: 'workspace', scopeId },
    });
    expect(jsonBody(response).data).toEqual([{ kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' }]);
  });
  it.each<Record<string, string | string[]>>([
    { scopeKind: 'workspace', scopeId: 'unknown' },
    { scopeKind: 'team', scopeId: 'north' },
    { scopeId: 'north' },
    { scopeKind: 'workspace' },
    { scopeKind: 'workspace', scopeId: '' },
    { scopeKind: 'workspace', scopeId: ['north', 'south'] },
    { scopeKind: 'workspace', scopeId: ['north', 'north'] },
    { scopeKind: ['workspace', 'workspace'], scopeId: 'north' },
  ])('rejects unknown or ambiguous scope', async query => {
    const backend = createMockBackend();
    const { accessToken } = await login(backend);
    for (const path of ['/api/menu', '/api/auth/codes']) {
      failure(await backend.dispatch({ method: 'GET', path, query, headers: auth(accessToken) }), 403, 'UNKNOWN_SCOPE');
    }
    failure(await backend.dispatch({ method: 'GET', path: '/api/menu', query }), 403, 'UNKNOWN_SCOPE');
  });
  it('does not treat an invalid bearer as an anonymous public menu request', async () => {
    failure(
      await createMockBackend().dispatch({ method: 'GET', path: '/api/menu', headers: auth('unknown') }),
      401,
      'UNAUTHENTICATED',
    );
  });
  it('never exposes supplied tokens or passwords in error envelopes', async () => {
    let time = 0;
    const backend = createMockBackend({ now: () => time });
    const pair = await login(backend);
    time = 300_000;
    const responses = [
      await backend.dispatch({ method: 'GET', path: '/api/menu', headers: auth(pair.accessToken) }),
      await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth('private-access-value') }),
      await backend.dispatch({
        method: 'POST',
        path: '/api/auth/refresh',
        body: { refreshToken: 'private-refresh-value' },
      }),
      await backend.dispatch({
        ...loginRequest,
        body: { username: 'demo@playground.invalid', password: 'private-password-value' },
      }),
    ];
    for (const [index, code] of [
      ACCESS_EXPIRED_CODE,
      'UNAUTHENTICATED',
      'INVALID_REFRESH',
      'INVALID_LOGIN',
    ].entries()) {
      failure(responses[index], 401, code);
      for (const secret of [
        pair.accessToken,
        pair.refreshToken,
        'private-access-value',
        'private-refresh-value',
        'private-password-value',
      ]) {
        expect(JSON.stringify(responses[index])).not.toContain(secret);
      }
    }
  });
  it('logout cannot revoke the other account via a mismatched refresh token', async () => {
    const backend = createMockBackend();
    const first = await login(backend);
    const second = await login(backend, 'second@playground.invalid');
    expect(
      (
        await backend.dispatch({
          method: 'POST',
          path: '/api/auth/logout',
          headers: auth(first.accessToken),
          body: { refreshToken: second.refreshToken },
        })
      ).status,
    ).toBe(200);
    failure(
      await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(first.accessToken) }),
      401,
      'UNAUTHENTICATED',
    );
    expect(
      jsonBody((await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(second.accessToken) }))).data,
    ).toMatchObject({ id: 'second-user' });
    expect(
      (
        await backend.dispatch({
          method: 'POST',
          path: '/api/auth/refresh',
          body: { refreshToken: second.refreshToken },
        })
      ).status,
    ).toBe(200);
  });
  it('rejects ambiguous authorization rather than returning an anonymous menu', async () => {
    failure(
      await createMockBackend().dispatch({
        method: 'GET',
        path: '/api/menu',
        headers: { authorization: ['Bearer one', 'Bearer two'] },
      }),
      401,
      'UNAUTHENTICATED',
    );
  });
  it('does not share mutable response fixtures across calls or backend instances', async () => {
    const a = createMockBackend();
    const response = await a.dispatch({ method: 'GET', path: '/api/menu' });
    (jsonBody(response).data as { pageId: string }[])[0].pageId = 'tampered';
    for (const backend of [a, createMockBackend()]) {
      expect(jsonBody((await backend.dispatch({ method: 'GET', path: '/api/menu' }))).data).toEqual([
        { kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' },
      ]);
    }
  });
  it('limits stored sessions and revokes the oldest session at capacity', async () => {
    const backend = createMockBackend();
    const first = await login(backend);
    for (let index = 0; index < 128; index++) await login(backend);
    failure(
      await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth(first.accessToken) }),
      401,
      'UNAUTHENTICATED',
    );
  });
  it('dispose clears sessions and closes the instance', async () => {
    const backend = createMockBackend();
    await login(backend);
    backend.dispose();
    failure(await backend.dispatch({ method: 'GET', path: '/api/health' }), 503, 'DISPOSED');
  });
});

it('opens an authenticated workspace upload session through the real dispatcher', async () => {
  const backend=createMockBackend();
  try {
    const tokens=await login(backend);
    const response=await backend.dispatch({method:'POST',path:'/api/transfers',headers:auth(tokens.accessToken),query:{scopeKind:'workspace',scopeId:'north'},body:{name:'example.txt',contentType:'text/plain',size:3}});
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({code:0,data:{uploadId:expect.any(String)}});
  } finally {backend.dispose();}
});
it('enforces session expiry and transfer grants before entering its repository',async()=>{
 let now=0;const backend=createMockBackend({now:()=>now});
 const request={method:'POST',path:'/api/transfers',query:{scopeKind:'workspace',scopeId:'north'},body:{name:'example.txt',contentType:'text/plain',size:3}};
 try{
  failure(await backend.dispatch(request),401,'UNAUTHENTICATED');
  const viewer=await login(backend,'second@playground.invalid');failure(await backend.dispatch({...request,headers:auth(viewer.accessToken)}),403,'FORBIDDEN');
  const admin=await login(backend);failure(await backend.dispatch({...request,headers:auth(admin.accessToken),query:{scopeKind:'workspace',scopeId:'south'}}),403,'FORBIDDEN');
  failure(await backend.dispatch({...request,headers:auth(admin.accessToken),query:new URLSearchParams('scopeKind=workspace&scopeId=north&scopeId=south')}),400,'INVALID_QUERY');
  now=300_001;failure(await backend.dispatch({...request,headers:auth(admin.accessToken)}),401,'ACCESS_EXPIRED');
 }finally{backend.dispose();}
});
