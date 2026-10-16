import type { RequestOutcome } from './errors';
import type { UploadPorts, UploadProgress, UploadSource } from './types';

export async function uploadChunks<R>(
  source: UploadSource,
  ports: UploadPorts<R>,
  options: {
    signal: AbortSignal;
    assertCurrent(): void;
    createCleanupSignal(): AbortSignal;
    onProgress?: (progress: UploadProgress) => void;
  },
): Promise<RequestOutcome<R>> {
  const aborted = (): RequestOutcome<never> => ({ ok: false, error: { kind: 'aborted' } });
  const protocol = (): RequestOutcome<never> => ({ ok: false, error: { kind: 'protocol' } });
  const totalBytes = source.size;
  const stopped = Symbol('upload-stopped');
  let uploadId: string | undefined;
  let retired = false;
  let finished = false;
  let succeeded = false;
  let cleaning = false;
  let acknowledgedBytes = 0;

  function assertLease() {
    try {
      options.assertCurrent();
    } catch {
      retired = true;
      throw stopped;
    }
  }
  function assertActive() {
    if (finished || options.signal.aborted) throw stopped;
    assertLease();
  }
  function cleanup() {
    if (cleaning || succeeded || uploadId === undefined || retired) return;
    try {
      // User cancellation does not retire the captured auth/scope lease.
      assertLease();
      cleaning = true;
      const signal = options.createCleanupSignal();
      assertLease();
      if (!signal.aborted) {
        // Best effort only: the app supplies a bounded signal. Never delay or replace the outcome.
        void ports.cancel(uploadId, signal).catch(() => {});
      }
    } catch {
      /* Expired lease or unavailable cleanup is left to server TTL. */
    }
  }
  let cancel!: () => void;
  const cancelled = new Promise<RequestOutcome<never>>(resolve => {
    cancel = () => {
      resolve(aborted());
      cleanup();
    };
  });
  options.signal.addEventListener('abort', cancel, { once: true });

  async function perform(): Promise<RequestOutcome<R>> {
    let failureKind: 'transport' | 'protocol' = 'transport';
    function progress(phase: UploadProgress['phase']) {
      assertActive();
      failureKind = 'protocol';
      options.onProgress?.({ acknowledgedBytes, totalBytes, phase });
      assertActive();
      failureKind = 'transport';
    }
    try {
      assertActive();
      if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) return protocol();
      const begun = await ports.begin(
        { name: source.name, contentType: source.contentType, size: totalBytes },
        options.signal,
      );
      // A begin port can ignore abort. Retain its late id solely for cleanup on the original lease.
      if (begun.ok) uploadId = begun.data.uploadId;
      assertActive();
      if (!begun.ok) return begun;
      if (typeof uploadId !== 'string' || !uploadId) return protocol();
      progress('uploading');
      for (let index = 0; acknowledgedBytes < totalBytes; index++) {
        assertActive();
        const end = Math.min(acknowledgedBytes + 32_768, totalBytes);
        const bytes = await source.read(acknowledgedBytes, end, options.signal);
        assertActive();
        if (!(bytes instanceof Uint8Array) || bytes.byteLength !== end - acknowledgedBytes) return protocol();
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const base64 = btoa(binary);
        assertActive();
        const ack = await ports.chunk({ uploadId, index, offset: acknowledgedBytes, base64 }, options.signal);
        assertActive();
        if (!ack.ok) return ack;
        if (ack.data.index !== index || ack.data.acknowledgedBytes !== end) return protocol();
        acknowledgedBytes = end;
        progress('uploading');
      }
      progress('completing');
      const completed = await ports.complete(uploadId, options.signal);
      assertActive();
      if (!completed.ok) return completed;
      progress('complete');
      succeeded = true;
      return completed;
    } catch (details) {
      if (details === stopped || options.signal.aborted || retired || finished) return aborted();
      // Check a lease invalidated by a rejected port as well as one returning normally.
      try {
        assertActive();
      } catch {
        return aborted();
      }
      return { ok: false, error: { kind: failureKind, details } };
    } finally {
      cleanup();
    }
  }
  try {
    const result = await Promise.race([perform(), cancelled]);
    assertActive();
    return result;
  } catch {
    succeeded = false;
    cleanup();
    return aborted();
  } finally {
    finished = true;
    options.signal.removeEventListener('abort', cancel);
  }
}
