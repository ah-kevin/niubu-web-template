import { describe, expect, it } from 'vitest';
import { TransferError } from './contracts';
import type { TransferOwner, UploadDescriptor } from './contracts';
import { dispatchTransfer, matchTransferRoute } from './dispatch';
import type { MockRequest, MockResponse } from '../dispatcher';
import { createTransferRepository } from './repository';

const owner: TransferOwner = { identityKey: 'user-a', scope: { kind: 'workspace', id: 'north' } };
const otherUser: TransferOwner = { ...owner, identityKey: 'user-b' };
const otherScope: TransferOwner = { ...owner, scope: { kind: 'workspace', id: 'south' } };
const descriptor: UploadDescriptor = { name: '文件.json', size: 3, contentType: 'application/json' };
const PART = 32_768;
const MAX_FILE = 1_048_576;

function setup(randomId?: () => string) {
  let now = 0;
  let sequence = 0;
  const repo = createTransferRepository({ now: () => now, randomId: randomId ?? (() => `file-${++sequence}`) });
  return { repo, advance: (ms: number) => (now += ms) };
}

function rejects(action: () => unknown, status: number, code?: string) {
  expect(action).toThrow(TransferError);
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ status, ...(code ? { code } : {}) });
  }
}

function put(repo: ReturnType<typeof createTransferRepository>, uploadId: string, bytes: Uint8Array, who = owner) {
  for (let offset = 0, index = 0; offset < bytes.length; offset += PART, index++) {
    repo.chunk(who, { uploadId, index, offset, base64: Buffer.from(bytes.subarray(offset, offset + PART)).toString('base64') });
  }
}

describe('bounded transfer repository', () => {
  it('confirms exact bytes, completes metadata, and clones every returned value', () => {
    const { repo } = setup();
    const input = { ...descriptor };
    const mutableOwner = { ...owner, scope: { ...owner.scope } };
    const begun = repo.begin(mutableOwner, input);
    const id = begun.uploadId;
    begun.uploadId = 'changed';
    input.name = 'changed';
    mutableOwner.identityKey = 'changed';
    mutableOwner.scope.id = 'changed';
    const ack = repo.chunk(owner, { uploadId: id, index: 0, offset: 0, base64: 'AAH/' });
    expect(ack).toEqual({ index: 0, acknowledgedBytes: 3 });
    Object.assign(ack, { acknowledgedBytes: 99 });
    expect(repo.chunk(owner, { uploadId: id, index: 0, offset: 0, base64: 'AAH/' })).toEqual({ index: 0, acknowledgedBytes: 3 });
    const file = repo.complete(owner, id);
    expect(file).toEqual({ id, ...descriptor });
    Object.assign(file, { name: 'changed', size: 99, contentType: 'changed' });
    const downloaded = repo.download(owner, id);
    expect(downloaded).toEqual({ name: descriptor.name, contentType: descriptor.contentType, bytes: new Uint8Array([0, 1, 255]) });
    downloaded.bytes.fill(9);
    downloaded.name = 'changed';
    expect(repo.download(owner, id).bytes).toEqual(new Uint8Array([0, 1, 255]));
  });

  it('accepts exact 32KiB serial parts, retries old parts with their original ACK, and completes 1MiB', () => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, { ...descriptor, size: MAX_FILE });
    const first = { uploadId, index: 0, offset: 0, base64: Buffer.alloc(PART, 7).toString('base64') };
    expect(repo.chunk(owner, first)).toEqual({ index: 0, acknowledgedBytes: PART });
    for (let index = 1; index < 32; index++) {
      expect(repo.chunk(owner, { ...first, index, offset: index * PART })).toEqual({ index, acknowledgedBytes: (index + 1) * PART });
    }
    expect(repo.chunk(owner, first)).toEqual({ index: 0, acknowledgedBytes: PART });
    expect(repo.complete(owner, uploadId).size).toBe(MAX_FILE);
    expect(repo.download(owner, uploadId).bytes).toEqual(new Uint8Array(MAX_FILE).fill(7));
  });

  it('requires the final part to match remaining bytes and rejects incomplete completion atomically', () => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, { ...descriptor, size: PART + 1 });
    rejects(() => repo.complete(owner, uploadId), 409);
    rejects(() => repo.download(owner, uploadId), 409);
    rejects(() => repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: 'AA==' }), 400);
    repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: Buffer.alloc(PART).toString('base64') });
    rejects(() => repo.complete(owner, uploadId), 409);
    rejects(() => repo.chunk(owner, { uploadId, index: 1, offset: PART, base64: 'AAA=' }), 400);
    expect(repo.chunk(owner, { uploadId, index: 1, offset: PART, base64: '/w==' })).toEqual({ index: 1, acknowledgedBytes: PART + 1 });
    repo.complete(owner, uploadId);
    expect(repo.download(owner, uploadId).bytes.at(-1)).toBe(255);
    rejects(() => repo.chunk(owner, { uploadId, index: 2, offset: PART + 1, base64: 'AA==' }), 409);
  });

  it('rejects conflicting retries without changing bytes or the original ACK', () => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, descriptor);
    const part = { uploadId, index: 0, offset: 0, base64: 'AAH/' };
    repo.chunk(owner, part);
    rejects(() => repo.chunk(owner, { ...part, base64: 'AAEA' }), 409);
    rejects(() => repo.chunk(owner, { ...part, offset: 1 }), 409);
    expect(repo.chunk(owner, part)).toEqual({ index: 0, acknowledgedBytes: 3 });
    repo.complete(owner, uploadId);
    expect(repo.chunk(owner, part)).toEqual({ index: 0, acknowledgedBytes: 3 });
    expect(repo.download(owner, uploadId).bytes).toEqual(new Uint8Array([0, 1, 255]));
  });

  it.each(['', 'A', 'AA', 'AAA', 'AA===', 'AA==\n', ' AA==', 'AA-_', '!!!!', 'AB==', 'AAF='])('strictly rejects noncanonical base64 %j', base64 => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, { ...descriptor, size: 1 });
    rejects(() => repo.chunk(owner, { uploadId, index: 0, offset: 0, base64 }), 400);
    expect(repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: 'AA==' }).acknowledgedBytes).toBe(1);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid index and offset %s before changing state', value => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, descriptor);
    rejects(() => repo.chunk(owner, { uploadId, index: value, offset: 0, base64: 'AAH/' }), 400);
    rejects(() => repo.chunk(owner, { uploadId, index: 0, offset: value, base64: 'AAH/' }), 400);
    expect(repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: 'AAH/' }).acknowledgedBytes).toBe(3);
  });

  it('rejects skipped index, wrong offset, and oversized parts without accepting any of them', () => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, { ...descriptor, size: PART + 1 });
    rejects(() => repo.chunk(owner, { uploadId, index: 1, offset: 0, base64: 'AA==' }), 409);
    rejects(() => repo.chunk(owner, { uploadId, index: 0, offset: 1, base64: 'AA==' }), 409);
    rejects(() => repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: Buffer.alloc(PART + 1).toString('base64') }), 400);
    put(repo, uploadId, new Uint8Array(PART + 1));
    expect(repo.complete(owner, uploadId).size).toBe(PART + 1);
  });

  it.each([-1, 0.1, NaN, Infinity, MAX_FILE + 1, Number.MAX_SAFE_INTEGER + 1])('rejects invalid declared size %s without using quota', size => {
    const { repo } = setup();
    rejects(() => repo.begin(owner, { ...descriptor, size }), 400);
    repo.begin(owner, descriptor);
    repo.begin(owner, descriptor);
  });

  it('bounds UTF-8 metadata and MIME ASCII, accepting exactly 255 filename bytes and 127 MIME bytes', () => {
    const { repo } = setup();
    rejects(() => repo.begin(owner, { ...descriptor, name: '界'.repeat(86) }), 400);
    rejects(() => repo.begin(owner, { ...descriptor, name: '\ud800' }), 400);
    rejects(() => repo.begin(owner, { ...descriptor, contentType: `text/plain;a=${'x'.repeat(115)}` }), 400);
    const { uploadId } = repo.begin(owner, { ...descriptor, size: 0, name: '界'.repeat(85), contentType: `text/plain;a=${'x'.repeat(114)}` });
    expect(Buffer.byteLength(repo.complete(owner, uploadId).name)).toBe(255);
  });

  it.each(['text', 'text/', '/plain', ' text/plain', 'text/plain ', 'text/plain;', 'text/plain; charset', 'text/plain; charset=', 'text/plain; a="unterminated', 'text/plain; a="x"junk', 'text/plain; a=x; a=y', 'text/☃', 'text/plain\r\nx: injected', 'text/plain\u0000', 'text/plain\u007f', 'text/plain; a="\t"'])('rejects invalid MIME %j before accepting a session', contentType => {
    const { repo } = setup();
    rejects(() => repo.begin(owner, { ...descriptor, contentType }), 400);
    repo.begin(owner, descriptor);
    repo.begin(owner, descriptor);
  });

  it.each(['application/json', 'application/problem+json', '', 'text/plain; charset=UTF-8', 'text/plain; note="a;b\\"c"'])('roundtrips source MIME %j solely as metadata, including zero bytes', contentType => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, { ...descriptor, size: 0, contentType });
    rejects(() => repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: 'AA==' }), 400);
    expect(repo.complete(owner, uploadId).contentType).toBe(contentType || 'application/octet-stream');
    expect(repo.download(owner, uploadId)).toEqual({ name: descriptor.name, contentType: contentType || 'application/octet-stream', bytes: new Uint8Array() });
  });

  it.each([otherUser, otherScope])('isolates every ID operation for owner %j', foreign => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, descriptor);
    rejects(() => repo.chunk(foreign, { uploadId, index: 0, offset: 0, base64: 'AAH/' }), 404);
    rejects(() => repo.complete(foreign, uploadId), 404);
    rejects(() => repo.cancel(foreign, uploadId), 404);
    rejects(() => repo.download(foreign, uploadId), 404);
    put(repo, uploadId, new Uint8Array([0, 1, 255]));
    repo.complete(owner, uploadId);
    rejects(() => repo.download(foreign, uploadId), 404);
    expect(repo.download(owner, uploadId).bytes.length).toBe(3);
  });

  it('uses unambiguous owner tuples and snapshots scope independently', () => {
    const { repo } = setup();
    const a: TransferOwner = { identityKey: 'x:y', scope: { kind: 'workspace', id: 'z' } };
    const b: TransferOwner = { identityKey: 'x', scope: { kind: 'workspace', id: 'y:z' } };
    const { uploadId } = repo.begin(a, { ...descriptor, size: 0 });
    rejects(() => repo.cancel(b, uploadId), 404);
    repo.complete(a, uploadId);
  });

  it('counts active and completed sessions toward two per owner; cancel frees both bytes and slots', () => {
    const { repo } = setup();
    const a = repo.begin(owner, { ...descriptor, size: MAX_FILE });
    const b = repo.begin(owner, { ...descriptor, size: MAX_FILE });
    put(repo, a.uploadId, new Uint8Array(MAX_FILE));
    repo.complete(owner, a.uploadId);
    rejects(() => repo.begin(owner, descriptor), 429);
    expect(repo.cancel(owner, a.uploadId)).toBeNull();
    rejects(() => repo.download(owner, a.uploadId), 404);
    rejects(() => repo.cancel(owner, a.uploadId), 404);
    repo.begin(owner, { ...descriptor, size: MAX_FILE });
    repo.cancel(owner, b.uploadId);
    rejects(() => repo.chunk(owner, { uploadId: b.uploadId, index: 0, offset: 0, base64: 'AAH/' }), 404);
  });

  it('bounds global sessions and reserved bytes at sixteen files / sixteen MiB, including completed', () => {
    const { repo } = setup();
    const records = Array.from({ length: 16 }, (_, index) => {
      const who = { ...owner, identityKey: `owner-${index}` };
      const { uploadId } = repo.begin(who, { ...descriptor, size: MAX_FILE });
      put(repo, uploadId, new Uint8Array(MAX_FILE).fill(index), who);
      repo.complete(who, uploadId);
      return { who, uploadId };
    });
    rejects(() => repo.begin(owner, { ...descriptor, size: 0 }), 429);
    for (const [index, record] of records.entries()) expect(repo.download(record.who, record.uploadId).bytes[0]).toBe(index);
    repo.cancel(records[0]!.who, records[0]!.uploadId);
    repo.begin(owner, { ...descriptor, size: MAX_FILE });
  });

  it('expires active and completed files at TTL 300000 and frees all quotas on the next operation', () => {
    const { repo, advance } = setup();
    const a = repo.begin(owner, { ...descriptor, size: 0 });
    const b = repo.begin(owner, descriptor);
    repo.complete(owner, a.uploadId);
    advance(299_999);
    expect(repo.download(owner, a.uploadId).bytes.length).toBe(0);
    advance(1);
    rejects(() => repo.download(owner, a.uploadId), 404);
    rejects(() => repo.complete(owner, b.uploadId), 404);
    repo.begin(owner, descriptor);
    repo.begin(owner, descriptor);
  });

  it('reaps the global quota even when an unrelated owner is the next requester', () => {
    const { repo, advance } = setup();
    for (let index = 0; index < 16; index++) repo.begin({ ...owner, identityKey: `owner-${index}` }, { ...descriptor, size: MAX_FILE });
    advance(300_000);
    repo.begin(otherUser, { ...descriptor, size: MAX_FILE });
  });

  it('never overwrites an existing session when the injected ID collides', () => {
    const { repo } = setup(() => 'same-id');
    repo.begin(owner, { ...descriptor, size: 0 });
    rejects(() => repo.begin(otherUser, descriptor), 409);
    expect(repo.complete(owner, 'same-id').size).toBe(0);
  });

  it('disposes idempotently and rejects every subsequent operation', () => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, descriptor);
    put(repo, uploadId, new Uint8Array([0, 1, 255]));
    repo.complete(owner, uploadId);
    repo.dispose();
    repo.dispose();
    for (const operation of [() => repo.begin(owner, descriptor), () => repo.chunk(owner, { uploadId, index: 0, offset: 0, base64: 'AAH/' }), () => repo.complete(owner, uploadId), () => repo.cancel(owner, uploadId), () => repo.download(owner, uploadId)]) rejects(operation, 503, 'DISPOSED');
  });
});

const query = { scopeKind: 'workspace', scopeId: 'north' };
const invalidQueries: MockRequest['query'][] = [
  undefined,
  {},
  { scopeKind: 'workspace' },
  { scopeId: 'north' },
  { scopeKind: ['workspace', 'workspace'], scopeId: 'north' },
  { scopeKind: 'workspace', scopeId: ['north', 'north'] },
  { ...query, owner: 'user-b' },
  { ...query, identityKey: 'user-b' },
];

function dispatch(repo: ReturnType<typeof createTransferRepository>, request: MockRequest, who = owner): MockResponse {
  const route = matchTransferRoute(request.path);
  if (!route) throw new Error('Test expected a transfer route');
  return dispatchTransfer(repo, route, { query, ...request }, who);
}

function jsonData(response: MockResponse): unknown {
  expect(response.kind).toBe('json');
  if (response.kind !== 'json') throw new Error('Expected JSON envelope');
  expect(response.status).toBe(200);
  expect(response.body.code).toBe(0);
  expect(response.headers).toMatchObject({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  return response.body.data;
}

describe('transfer wire dispatch without a listening server', () => {
  it.each([
    ['/api/transfers', { operation: 'begin', methods: ['POST'] }],
    ['/api/transfers/file-1', { operation: 'cancel', id: 'file-1', methods: ['DELETE'] }],
    ['/api/transfers/file-1/parts/0', { operation: 'chunk', id: 'file-1', index: 0, methods: ['PUT'] }],
    ['/api/transfers/file-1/complete', { operation: 'complete', id: 'file-1', methods: ['POST'] }],
    ['/api/transfers/file-1/download', { operation: 'download', id: 'file-1', methods: ['GET'] }],
  ])('matches only the frozen route %s', (path, expected) => {
    expect(matchTransferRoute(path as string)).toEqual(expected);
  });

  it.each(['/api/transfers/', '/api/transfers/a/parts/-1', '/api/transfers/a/parts/01', '/api/transfers/a/parts/1.0', '/api/transfers/a/parts/9007199254740992', '/api/transfers/%2f/download', '/api/transfers/../download', '/api/transfers/a/download?scopeId=north', `/api/transfers/${'a'.repeat(129)}`, '/api/transfers/a/unknown'])('does not match malformed paths %s', path => {
    expect(matchTransferRoute(path)).toBeNull();
  });

  it.each([
    ['application/json', '{"hello":"world"}'],
    ['application/json', '{"code":0,"data":null,"message":"OK"}'],
    ['application/problem+json', '{"code":401,"data":null,"message":"no"}'],
    ['', 'ordinary bytes'],
    ['application/json', ''],
  ])('downloads original bytes with octet-stream independent of source MIME %j', (contentType, source) => {
    const { repo } = setup();
    const bytes = Buffer.from(source);
    expect(jsonData(dispatch(repo, { method: 'POST', path: '/api/transfers', body: { ...descriptor, size: bytes.length, contentType } }))).toEqual({ uploadId: 'file-1' });
    if (bytes.length) expect(jsonData(dispatch(repo, { method: 'PUT', path: '/api/transfers/file-1/parts/0', body: { offset: 0, base64: bytes.toString('base64') } }))).toEqual({ index: 0, acknowledgedBytes: bytes.length });
    expect(jsonData(dispatch(repo, { method: 'POST', path: '/api/transfers/file-1/complete', body: {} }))).toEqual({ id: 'file-1', name: descriptor.name, size: bytes.length, contentType: contentType || 'application/octet-stream' });
    const response = dispatch(repo, { method: 'GET', path: '/api/transfers/file-1/download' });
    expect(response).toMatchObject({ kind: 'binary', status: 200, headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } });
    if (response.kind !== 'binary') throw new Error('Expected raw file bytes');
    expect(response.body).toEqual(new Uint8Array(bytes));
  });

  it('only replays identical PUTs; JSON replies preserve the envelope and cancel returns null', () => {
    const { repo } = setup();
    jsonData(dispatch(repo, { method: 'POST', path: '/api/transfers', body: descriptor }));
    const part = { method: 'PUT', path: '/api/transfers/file-1/parts/0', body: { offset: 0, base64: 'AAH/' } };
    expect(jsonData(dispatch(repo, part))).toEqual({ index: 0, acknowledgedBytes: 3 });
    expect(jsonData(dispatch(repo, part))).toEqual({ index: 0, acknowledgedBytes: 3 });
    rejects(() => dispatch(repo, { ...part, body: { offset: 0, base64: 'AAEA' } }), 409);
    expect(jsonData(dispatch(repo, { method: 'DELETE', path: '/api/transfers/file-1' }))).toBeNull();
    rejects(() => dispatch(repo, { method: 'GET', path: '/api/transfers/file-1/download' }), 404);
  });

  it.each(invalidQueries)('rejects incomplete, duplicate, or unknown query fields %j before allocation', invalidQuery => {
    const { repo } = setup();
    rejects(() => dispatch(repo, { method: 'POST', path: '/api/transfers', body: descriptor, query: invalidQuery }), 400);
    repo.begin(owner, descriptor);
    repo.begin(owner, descriptor);
  });

  it.each([{ scopeKind: 'account', scopeId: 'north' }, { scopeKind: 'workspace', scopeId: 'south' }])('rejects scope inconsistent with authenticated owner %j', invalidQuery => {
    const { repo } = setup();
    rejects(() => dispatch(repo, { method: 'POST', path: '/api/transfers', body: descriptor, query: invalidQuery }), 403);
  });

  it('accepts URLSearchParams and still rejects duplicate scope parameters', () => {
    const { repo } = setup();
    jsonData(dispatch(repo, { method: 'POST', path: '/api/transfers', body: descriptor, query: new URLSearchParams(query) }));
    rejects(() => dispatch(repo, { method: 'POST', path: '/api/transfers', body: descriptor, query: new URLSearchParams('scopeKind=workspace&scopeId=north&scopeId=north') }), 400);
  });

  it.each(['owner', 'identityKey', 'scope', 'scopeId', 'uploadId', 'extra'])('never trusts the body %s as authority or an override', key => {
    const { repo } = setup();
    rejects(() => dispatch(repo, { method: 'POST', path: '/api/transfers', body: { ...descriptor, [key]: 'forged' } }), 400);
  });

  it.each([
    ['POST', '/api/transfers', { name: 'a', size: 0 }],
    ['POST', '/api/transfers', { name: 'a', size: '0', contentType: '' }],
    ['POST', '/api/transfers', { name: 0, size: 0, contentType: '' }],
    ['POST', '/api/transfers', { name: 'a', size: 0, contentType: null }],
    ['PUT', '/api/transfers/file-1/parts/0', { offset: 0, base64: 'AAH/', index: 1 }],
    ['PUT', '/api/transfers/file-1/parts/0', { offset: 0, base64: 'AAH/', uploadId: 'file-2' }],
    ['PUT', '/api/transfers/file-1/parts/0', { offset: '0', base64: 'AAH/' }],
    ['PUT', '/api/transfers/file-1/parts/0', { offset: 0, base64: null }],
    ['POST', '/api/transfers/file-1/complete', { owner: 'user-b' }],
    ['DELETE', '/api/transfers/file-1', { id: 'file-2' }],
    ['GET', '/api/transfers/file-1/download', { scopeId: 'south' }],
  ])('checks exact body shape for %s %s', (method, path, body) => {
    const { repo } = setup();
    repo.begin(owner, descriptor);
    rejects(() => dispatch(repo, { method, path, body }), 400);
  });

  it('uses the unchanged 65536-byte JSON body limit before decoding parts', () => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, descriptor);
    const request = { method: 'PUT', path: `/api/transfers/${uploadId}/parts/0`, body: JSON.stringify({ offset: 0, base64: 'a'.repeat(65_536) }) };
    expect(() => dispatch(repo, request)).toThrow(expect.objectContaining({ status: 413, code: 'BODY_TOO_LARGE' }));
  });

  it.each([undefined, null, [], 'bad json', 'null', '[]'])('rejects malformed JSON object input %j', body => {
    const { repo } = setup();
    expect(() => dispatch(repo, { method: 'POST', path: '/api/transfers', body })).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('checks the canonical request path, route operation, index, ID, and method before touching the repo', () => {
    const { repo } = setup();
    const request = { method: 'POST', path: '/api/transfers', body: descriptor, query };
    const route = matchTransferRoute(request.path)!;
    rejects(() => dispatchTransfer(repo, { ...route, operation: 'cancel', id: 'file-1' }, request, owner), 400);
    rejects(() => dispatchTransfer(repo, route, { ...request, path: '/api/transfers/file-1/complete' }, owner), 400);
    rejects(() => dispatchTransfer(repo, { ...route, methods: ['GET'] }, request, owner), 400);
    rejects(() => dispatchTransfer(repo, route, { ...request, method: 'GET' }, owner), 405);
    const { uploadId } = repo.begin(owner, descriptor);
    const part = { method: 'PUT', path: `/api/transfers/${uploadId}/parts/0`, query, body: { offset: 0, base64: 'AAH/' } };
    const partRoute = matchTransferRoute(part.path)!;
    rejects(() => dispatchTransfer(repo, { ...partRoute, index: 1 }, part, owner), 400);
    rejects(() => dispatchTransfer(repo, { ...partRoute, id: 'other' }, part, owner), 400);
  });

  it.each([
    ['../../文件\r\n"evil?.json', '文件evil.json'],
    ['C:\\folder\\..', 'download'],
    ['.', 'download'],
    ['', 'download'],
    ['文 件(1)\'%.json', '文 件(1)\'%.json'],
  ])('cleans download filename %j into safe disposition parameters', (name, expected) => {
    const { repo } = setup();
    const { uploadId } = repo.begin(owner, { ...descriptor, name, size: 0 });
    repo.complete(owner, uploadId);
    const response = dispatch(repo, { method: 'GET', path: `/api/transfers/${uploadId}/download` });
    const header = response.headers?.['content-disposition'];
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(header).not.toMatch(/[^\x20-\x7e]/);
    const encoded = header?.split("filename*=UTF-8''")[1];
    expect(decodeURIComponent(encoded ?? '')).toBe(expected);
    expect(encoded).not.toMatch(/['()*]/);
  });
});
