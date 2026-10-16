import type { RequestError, RequestOutcome } from './errors';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
/** Generic wire boundary only. Business payload validation belongs to decode. */
export function readWireEnvelope(
  value: unknown,
  status: number,
  metadata: Pick<RequestError, 'requestId' | 'traceId'> = {},
): RequestOutcome<unknown> {
  if (
    !record(value) ||
    !Object.hasOwn(value, 'code') ||
    !Object.hasOwn(value, 'data') ||
    !Object.hasOwn(value, 'message') ||
    typeof value.message !== 'string' ||
    !(
      (typeof value.code === 'number' && Number.isFinite(value.code)) ||
      (typeof value.code === 'string' && value.code.trim().length > 0)
    )
  )
    return { ok: false, error: { kind: 'protocol', ...metadata, status } };
  if (value.code === 0 && status >= 200 && status < 300) return { ok: true, data: value.data };
  return {
    ok: false,
    error: {
      kind: 'http',
      ...metadata,
      status,
      code: String(value.code),
      message: value.message,
      details: value.data,
    },
  };
}
