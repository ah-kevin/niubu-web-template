import type { MockRequest, MockResponse } from '../dispatcher';
import { parseBody } from '../body';
import { TransferError } from './contracts';
import type { TransferOwner, TransferRoute } from './contracts';
import type { TransferRepository } from './repository';

export function matchTransferRoute(path: string): TransferRoute | null {
  if (path === '/api/transfers') return { operation: 'begin', methods: ['POST'] };
  const match =
    /^\/api\/transfers\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})(?:\/(complete|download)|\/parts\/(0|[1-9][0-9]*))?$/.exec(
      path,
    );
  if (!match) return null;
  if (match[3] !== undefined) {
    const index = Number(match[3]);
    return Number.isSafeInteger(index) ? { operation: 'chunk', id: match[1], index, methods: ['PUT'] } : null;
  }
  if (match[2] === 'complete') return { operation: 'complete', id: match[1], methods: ['POST'] };
  if (match[2] === 'download') return { operation: 'download', id: match[1], methods: ['GET'] };
  return { operation: 'cancel', id: match[1], methods: ['DELETE'] };
}

export function dispatchTransfer(
  repo: TransferRepository,
  route: TransferRoute,
  request: MockRequest,
  owner: TransferOwner,
): MockResponse {
  const canonical = matchTransferRoute(request.path);
  if (
    !canonical ||
    canonical.operation !== route.operation ||
    canonical.id !== route.id ||
    canonical.index !== route.index ||
    canonical.methods.length !== route.methods.length ||
    canonical.methods.some((method, index) => route.methods[index] !== method)
  )
    throw new TransferError(400, 'INVALID_ROUTE', 'Transfer route does not match the request path');
  if (!canonical.methods.includes(request.method)) {
    throw new TransferError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  validateQuery(request.query, owner);
  let data: unknown;
  switch (route.operation) {
    case 'begin': {
      const body = exactBody(request.body, ['name', 'size', 'contentType']);
      if (typeof body.name !== 'string' || typeof body.size !== 'number' || typeof body.contentType !== 'string') {
        throw new TransferError(400, 'INVALID_METADATA', 'Transfer metadata has invalid field types');
      }
      data = repo.begin(owner, { name: body.name, size: body.size, contentType: body.contentType });
      break;
    }
    case 'chunk': {
      const body = exactBody(request.body, ['offset', 'base64']);
      if (typeof body.offset !== 'number' || typeof body.base64 !== 'string') {
        throw new TransferError(400, 'INVALID_PART', 'Transfer part has invalid field types');
      }
      data = repo.chunk(owner, { uploadId: route.id!, index: route.index!, offset: body.offset, base64: body.base64 });
      break;
    }
    case 'complete':
      exactBody(request.body, []);
      data = repo.complete(owner, route.id!);
      break;
    case 'cancel':
      if (request.body !== undefined) exactBody(request.body, []);
      data = repo.cancel(owner, route.id!);
      break;
    case 'download': {
      if (request.body !== undefined) exactBody(request.body, []);
      const file = repo.download(owner, route.id!);
      return {
        kind: 'binary',
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': contentDisposition(file.name),
          'cache-control': 'no-store',
        },
        body: file.bytes,
      };
    }
    default:
      throw new TransferError(400, 'INVALID_ROUTE', 'Invalid transfer operation');
  }
  return {
    kind: 'json',
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: { code: 0, data, message: 'OK' },
  };
}

function exactBody(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const body = parseBody(input);
  if (Object.keys(body).length !== keys.length || keys.some(key => !Object.hasOwn(body, key))) {
    throw new TransferError(400, 'INVALID_BODY', 'Unexpected or missing transfer body fields');
  }
  return body;
}

function validateQuery(input: MockRequest['query'], owner: TransferOwner): void {
  const query = new URLSearchParams();
  if (input instanceof URLSearchParams) {
    input.forEach((value, key) => query.append(key, value));
  } else {
    for (const [key, value] of Object.entries(input ?? {})) {
      for (const item of typeof value === 'string' ? [value] : value) query.append(key, item);
    }
  }
  if (
    [...query.keys()].some(key => key !== 'scopeKind' && key !== 'scopeId') ||
    query.getAll('scopeKind').length !== 1 ||
    query.getAll('scopeId').length !== 1
  )
    throw new TransferError(400, 'INVALID_QUERY', 'Exactly one workspace kind and scope ID are required');
  if (
    query.get('scopeKind') !== 'workspace' ||
    owner.scope.kind !== 'workspace' ||
    query.get('scopeId') !== owner.scope.id
  ) {
    throw new TransferError(403, 'UNKNOWN_SCOPE', 'Transfer scope does not match the verified owner');
  }
}

function contentDisposition(sourceName: string): string {
  const segment = sourceName.split(/[/\\]/).at(-1) ?? '';
  const cleaned = Array.from(segment)
    .filter(char => {
      const code = char.codePointAt(0)!;
      return code > 31 && (code < 127 || code > 159);
    })
    .join('')
    .replace(/[<>:"|?*]/g, '')
    .trim();
  const name = !cleaned || cleaned === '.' || cleaned === '..' ? 'download' : cleaned;
  const fallback = name.replace(/[^\x20-\x7e]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
