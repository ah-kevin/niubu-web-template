export type RequestError = {
  kind: 'not-enabled' | 'aborted' | 'transport' | 'http' | 'protocol';
  code?: string;
  message?: string;
  status?: number;
  requestId?: string;
  traceId?: string;
  details?: unknown;
};
export type RequestOutcome<T> = { ok: true; data: T } | { ok: false; error: RequestError };
