/** A lease bounds side effects; aborting cannot undo an already accepted server write. */
export type OperationLease = { readonly signal: AbortSignal; readonly current: () => boolean };
export function createOperationOwner() {
  let active: { controller: AbortController; unlink: () => void } | undefined;
  function cancel() {
    const old = active;
    active = undefined;
    old?.unlink();
    old?.controller.abort();
  }
  return {
    cancel,
    begin(signal?: AbortSignal): OperationLease {
      cancel();
      const controller = new AbortController();
      const operation = { controller, unlink: () => signal?.removeEventListener('abort', abort) };
      function abort() {
        if (active === operation) cancel();
      }
      active = operation;
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) cancel();
      return { signal: controller.signal, current: () => active === operation && !controller.signal.aborted };
    },
    complete(lease: OperationLease) {
      if (!lease.current()) return false;
      active?.unlink();
      active = undefined;
      return true;
    },
  };
}
