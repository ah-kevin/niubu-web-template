import type { EnabledRequestOptions, RequestClient, RequestSpec, ResponseMetadata } from './types';
import type { RequestError, RequestOutcome } from './errors';
import { createDisabledRequestClient } from './disabled';
import { createRenewalCoordinator } from './renewal';
import { readWireEnvelope } from './wire-envelope';

type Pending = { generation: number; cancel(): void };
const aborted = (): RequestOutcome<never> => ({ ok: false, error: { kind: 'aborted' } });
/** Native fetch is an explicit injection. No global credentials, retries or expiry rules. */
export function createRequestClient(input: { mode: 'disabled' } | EnabledRequestOptions): RequestClient {
  if (input.mode === 'disabled') return createDisabledRequestClient(input);
  const options = input;
  const renewal = options.renewal && createRenewalCoordinator(options.renewal);
  const pending = new Set<Pending>();
  let disposed = false;
  function normalize(error: RequestError): RequestOutcome<never> {
    if (error.kind === 'aborted') return aborted();
    try {
      return { ok: false, error: options.errorNormalizer(error) };
    } catch (details) {
      return { ok: false, error: { kind: 'protocol', details } };
    }
  }
  return {
    mode: 'enabled',
    async execute<T>(spec: RequestSpec<T>): Promise<RequestOutcome<T>> {
      if (disposed || spec.signal?.aborted) return aborted();
      const generation = options.getGeneration();
      const startedRevision = renewal?.getRevision() ?? 0;
      for (const request of pending)
        if (request.generation !== generation) {
          request.cancel();
          renewal?.dispose();
        }
      const controller = new AbortController();
      let cancelResult!: () => void;
      const cancelled = new Promise<RequestOutcome<never>>(resolve => {
        cancelResult = () => resolve(aborted());
      });
      const request: Pending = {
        generation,
        cancel() {
          controller.abort();
          cancelResult();
        },
      };
      pending.add(request);
      spec.signal?.addEventListener('abort', request.cancel, { once: true });
      function assertActive() {
        if (disposed || controller.signal.aborted || options.getGeneration() !== generation) {
          request.cancel();
          throw new DOMException('Request aborted', 'AbortError');
        }
      }
      async function attempt(): Promise<RequestOutcome<T>> {
        assertActive();
        let credentials: Pick<RequestInit, 'headers' | 'credentials'>;
        let response: Response;
        try {
          credentials = await options.credentialsProvider(controller.signal);
          assertActive();
          const url = new URL(spec.path, options.baseURL);
          // A request path cannot escape the explicitly injected origin.
          if (url.origin !== new URL(options.baseURL).origin) return normalize({ kind: 'protocol' });
          if (spec.query) {
            const query = new URLSearchParams();
            if (spec.query instanceof URLSearchParams) {
              for (const key of new Set(spec.query.keys())) url.searchParams.delete(key);
              for (const [key, value] of spec.query) query.append(key, value);
            } else {
              for (const [key, value] of Object.entries(spec.query)) {
                if (value === null || value === undefined) continue;
                url.searchParams.delete(key);
                for (const item of Array.isArray(value) ? value : [value]) query.append(key, String(item));
              }
            }
            for (const [key, value] of query) url.searchParams.append(key, value);
          }
          const headers = new Headers(spec.headers);
          new Headers(credentials.headers).forEach((value, key) => headers.set(key, value));
          response = await options.fetch(url.href, {
            ...credentials,
            method: spec.method,
            headers,
            body: spec.body,
            signal: controller.signal,
          });
          assertActive();
        } catch (details) {
          assertActive();
          return normalize({ kind: 'transport', details });
        }
        const tracing: Pick<RequestError, 'requestId' | 'traceId'> = {};
        const requestId = response.headers.get('X-Request-Id');
        const traceId = response.headers.get('X-Trace-Id');
        if (requestId !== null) tracing.requestId = requestId;
        if (traceId !== null) tracing.traceId = traceId;
        const metadata: ResponseMetadata = {
          ...tracing,
          status: response.status,
          headers: Object.fromEntries(response.headers),
        };
        const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        const jsonMime = mime === 'application/json' || Boolean(mime?.endsWith('+json'));
        let payload: unknown;
        try {
          if (spec.responseType === 'blob' && response.ok && !jsonMime) {
            if (!mime || !/^[!#$%&'*+.^_`|~\da-z-]+\/[!#$%&'*+.^_`|~\da-z-]+$/.test(mime))
              return normalize({ kind: 'protocol', ...tracing, status: response.status });
            payload = await response.blob();
            assertActive();
          } else {
            const wire: unknown = await response.json();
            assertActive();
            const outcome = readWireEnvelope(wire, response.status, tracing);
            if (!outcome.ok) return normalize(outcome.error);
            if (spec.responseType === 'blob')
              return normalize({ kind: 'protocol', ...tracing, status: response.status });
            payload = outcome.data;
          }
        } catch (details) {
          assertActive();
          return normalize({ kind: 'protocol', ...tracing, status: response.status, details });
        }
        try {
          const data = await spec.decode(payload, metadata);
          assertActive();
          return { ok: true, data };
        } catch (details) {
          assertActive();
          return normalize({ kind: 'protocol', ...tracing, status: response.status, details });
        }
      }
      async function perform(): Promise<RequestOutcome<T>> {
        try {
          assertActive();
          if (spec.activity === 'foreground') options.activityReporter();
          const first = await attempt();
          assertActive();
          const replay = spec.allowReplay ?? ['GET', 'HEAD', 'OPTIONS'].includes(spec.method.toUpperCase());
          if (!first.ok && replay && renewal && options.renewal?.shouldRenew(first.error)) {
            const renewed = await renewal.wait(generation, controller.signal, startedRevision);
            assertActive();
            if (!renewed.ok) return normalize(renewed.error);
            const replayed = await attempt();
            assertActive();
            return replayed;
          }
          return first;
        } catch (details) {
          if (controller.signal.aborted || disposed || options.getGeneration() !== generation) return aborted();
          return normalize({ kind: 'transport', details });
        }
      }
      try {
        const outcome = await Promise.race([perform(), cancelled]);
        return disposed || controller.signal.aborted || options.getGeneration() !== generation ? aborted() : outcome;
      } finally {
        pending.delete(request);
        spec.signal?.removeEventListener('abort', request.cancel);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const request of pending) request.cancel();
      renewal?.dispose();
    },
  };
}
