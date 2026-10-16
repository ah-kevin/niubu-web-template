export const MAX_BODY_BYTES = 65_536;

export class BodyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readRequestBody(stream: AsyncIterable<string | Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_BODY_BYTES) throw new BodyError(413, 'BODY_TOO_LARGE', 'JSON body exceeds 65536 bytes');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseBody(body: unknown): Record<string, unknown> {
  let json: string;
  try {
    json = typeof body === 'string' ? body : JSON.stringify(body);
  } catch {
    throw new BodyError(400, 'INVALID_BODY', 'Expected a JSON object');
  }
  if (json === undefined) throw new BodyError(400, 'INVALID_BODY', 'Expected a JSON object');
  if (Buffer.byteLength(json) > MAX_BODY_BYTES)
    throw new BodyError(413, 'BODY_TOO_LARGE', 'JSON body exceeds 65536 bytes');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new BodyError(400, 'INVALID_JSON', 'Malformed JSON body');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BodyError(400, 'INVALID_BODY', 'Expected a JSON object');
  return value as Record<string, unknown>;
}
