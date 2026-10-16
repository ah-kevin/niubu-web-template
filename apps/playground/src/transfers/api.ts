import { z } from 'zod';
import {
  downloadBlob,
  isAccessExpired,
  uploadChunks,
  type RequestClient,
  type RequestOutcome,
  type RequestSpec,
} from '@niubu/request';
import type { AuthContext } from '@niubu/types';
import { userSchema } from '../auth/schemas';
import type { TransferApi } from './contracts';
import { sameTransferContext, snapshotTransferContext } from './lease';

const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/);
const nameSchema = z.string().refine(
  value =>
    new TextEncoder().encode(value).length <= 255 &&
    Array.from(value).every(char => {
      const code = char.codePointAt(0)!;
      return code < 0xd800 || code > 0xdfff;
    }),
);
function validContentType(value: string): boolean {
  if (!value) return true;
  if (/[^\x20-\x7e]/.test(value)) return false;
  const mime = /^[!#$%&'*+.^_`|~\da-z-]+\/[!#$%&'*+.^_`|~\da-z-]+/i.exec(value);
  if (!mime) return false;
  let rest = value.slice(mime[0].length);
  const names = new Set<string>();
  while (rest) {
    const parameter = /^; *([!#$%&'*+.^_`|~\da-z-]+)=([!#$%&'*+.^_`|~\da-z-]+|"(?:[ !#-\x5b\x5d-~]|\\[ -~])*")/i.exec(
      rest,
    );
    if (!parameter || names.has(parameter[1].toLowerCase())) return false;
    names.add(parameter[1].toLowerCase());
    rest = rest.slice(parameter[0].length);
  }
  return true;
}
const descriptorSchema = z
  .object({
    name: nameSchema,
    size: z.number().int().min(0).max(1_048_576),
    contentType: z.string().max(127).refine(validContentType),
  })
  .strict();
const beginSchema = z.object({ uploadId: idSchema }).strict();
const ackSchema = z
  .object({ index: z.number().int().nonnegative().safe(), acknowledgedBytes: z.number().int().nonnegative().safe() })
  .strict();
const fileSchema = descriptorSchema.extend({ id: idSchema }).strict();
const aborted = (): RequestOutcome<never> => ({ ok: false, error: { kind: 'aborted' } });
const protocol = (): RequestOutcome<never> => ({ ok: false, error: { kind: 'protocol' } });

/** One app binding over the protected client; credentials and renewal remain with its owner. */
export function createTransferApi(
  client: RequestClient,
  getContext: () => AuthContext | null,
  getSessionSignal?: () => AbortSignal,
): TransferApi {
  function capture(context: AuthContext, userSignal?: AbortSignal) {
    try {
      if (!getSessionSignal) return null;
      const captured = snapshotTransferContext(context);
      const session = getSessionSignal();
      const current = () =>
        !session.aborted && getSessionSignal() === session && sameTransferContext(captured, getContext());
      if (
        !captured.identityKey ||
        !Number.isSafeInteger(captured.generation) ||
        captured.generation < 0 ||
        captured.scope?.kind !== 'workspace' ||
        !captured.scope.id ||
        userSignal?.aborted ||
        !current()
      )
        return null;
      const signal = userSignal ? AbortSignal.any([session, userSignal]) : session;
      const query = { scopeKind: captured.scope.kind, scopeId: captured.scope.id };
      const assertCurrent = () => {
        if (!current()) throw new DOMException('Transfer lease retired', 'AbortError');
      };
      async function run<T>(
        operationSignal: AbortSignal,
        work: () => Promise<RequestOutcome<T>>,
      ): Promise<RequestOutcome<T>> {
        if (operationSignal.aborted || !current()) return aborted();
        let onAbort!: () => void;
        const cancelled = new Promise<RequestOutcome<never>>(resolve => {
          onAbort = () => resolve(aborted());
          operationSignal.addEventListener('abort', onAbort, { once: true });
        });
        try {
          const result = await Promise.race([
            Promise.resolve()
              .then(() => (operationSignal.aborted || !current() ? aborted() : work()))
              .catch((details: unknown): RequestOutcome<never> => ({
                ok: false,
                error: { kind: 'transport', details },
              })),
            cancelled,
          ]);
          return !operationSignal.aborted && current() ? result : aborted();
        } finally {
          operationSignal.removeEventListener('abort', onAbort);
        }
      }
      function send<T>(spec: Omit<RequestSpec<T>, 'query' | 'signal'>, operationSignal: AbortSignal) {
        return run(operationSignal, () => client.execute({ ...spec, query, signal: operationSignal }));
      }
      const cleanupSignal = () => {
        assertCurrent();
        return AbortSignal.any([session, AbortSignal.timeout(5_000)]);
      };
      return { signal, query, current, assertCurrent, run, send, cleanupSignal };
    } catch {
      return null;
    }
  }
  return {
    async upload(context, source, options) {
      const lease = capture(context, options.signal);
      if (!lease) return aborted();
      const parsed = descriptorSchema.safeParse({
        name: source.name,
        contentType: source.contentType,
        size: source.size,
      });
      if (!parsed.success) return protocol();
      const descriptor = parsed.data;
      const headers = { 'Content-Type': 'application/json' };
      let uploadId: string | undefined;
      const result = await uploadChunks(
        { ...descriptor, read: (...args) => source.read(...args) },
        {
          async begin(input, signal) {
            const outcome = await lease.send(
              {
                path: '/api/transfers',
                method: 'POST',
                headers,
                body: JSON.stringify(input),
                activity: 'foreground',
                allowReplay: false,
                decode: data => beginSchema.parse(data),
              },
              signal,
            );
            if (outcome.ok) uploadId = outcome.data.uploadId;
            return outcome;
          },
          chunk: (input, signal) =>
            lease.send(
              {
                path: `/api/transfers/${input.uploadId}/parts/${input.index}`,
                method: 'PUT',
                headers,
                body: JSON.stringify({ offset: input.offset, base64: input.base64 }),
                activity: 'foreground',
                allowReplay: true,
                decode: data => ackSchema.parse(data),
              },
              signal,
            ),
          complete: (id, signal) =>
            lease.send(
              {
                path: `/api/transfers/${id}/complete`,
                method: 'POST',
                headers,
                body: '{}',
                activity: 'foreground',
                allowReplay: false,
                decode: data => {
                  const file = fileSchema.parse(data);
                  if (
                    file.id !== id ||
                    file.name !== descriptor.name ||
                    file.size !== descriptor.size ||
                    file.contentType !== (descriptor.contentType || 'application/octet-stream')
                  )
                    throw Error('Transfer completion does not match the upload session');
                  return file;
                },
              },
              signal,
            ),
          cancel: (id, signal) =>
            lease.send(
              {
                path: `/api/transfers/${id}`,
                method: 'DELETE',
                activity: 'background',
                allowReplay: false,
                decode: data => {
                  z.null().parse(data);
                },
              },
              signal,
            ),
        },
        {
          signal: lease.signal,
          assertCurrent: lease.assertCurrent,
          createCleanupSignal: lease.cleanupSignal,
          onProgress: options.onProgress,
        },
      );
      if (lease.signal.aborted || !lease.current()) return aborted();
      if (result.ok || !isAccessExpired(result.error)) return result;
      const recovered = await lease.send(
        { path: '/api/user', method: 'GET', activity: 'background', decode: data => userSchema.parse(data) },
        lease.signal,
      );
      if (lease.signal.aborted || !lease.current()) return aborted();
      if (!recovered.ok) return recovered;
      if (uploadId) {
        // Retry cleanup once after renewal, on the original live session only. Never retry the write.
        const signal = lease.cleanupSignal();
        void lease.send(
          {
            path: `/api/transfers/${uploadId}`,
            method: 'DELETE',
            activity: 'background',
            allowReplay: false,
            decode: data => {
              z.null().parse(data);
            },
          },
          signal,
        );
      }
      return { ok: false, error: { kind: 'protocol', code: 'TRANSFER_RECONFIRM' } };
    },
    async download(context, id, signal) {
      const lease = capture(context, signal);
      if (!lease) return aborted();
      const parsed = idSchema.safeParse(id);
      if (!parsed.success) return protocol();
      return lease.run(lease.signal, () =>
        downloadBlob(client, {
          path: `/api/transfers/${parsed.data}/download`,
          method: 'GET',
          query: lease.query,
          activity: 'foreground',
          signal: lease.signal,
        }),
      );
    },
  };
}
