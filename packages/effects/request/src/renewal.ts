import type { RequestOutcome } from './errors';
import type { RenewalPolicy } from './types';

type Flight = {
  generation: number;
  controller: AbortController;
  result: Promise<RequestOutcome<void>>;
  cancel(): void;
  waiters: number;
  settled: boolean;
};
const aborted = (): RequestOutcome<void> => ({ ok: false, error: { kind: 'aborted' } });
/** One coordinator per client. Its cancellation race does not trust the injected renew implementation. */
export function createRenewalCoordinator(policy: RenewalPolicy) {
  let current: Flight | undefined;
  let revision = 0;
  let renewedGeneration: number | undefined;
  function clear(flight: Flight) {
    if (current === flight) current = undefined;
  }
  function start(generation: number): Flight {
    const controller = new AbortController();
    let cancel!: () => void;
    const cancelled = new Promise<RequestOutcome<void>>(resolve => {
      cancel = () => {
        controller.abort();
        resolve(aborted());
      };
    });
    const flight: Flight = {
      generation,
      controller,
      cancel,
      waiters: 0,
      settled: false,
      result: Promise.resolve(aborted()),
    };
    flight.result = Promise.race([
      Promise.resolve()
        .then(() => (controller.signal.aborted ? aborted() : policy.renew(controller.signal)))
        .catch((details: unknown): RequestOutcome<void> => ({ ok: false, error: { kind: 'transport', details } })),
      cancelled,
    ]).then(result => {
      flight.settled = true;
      clear(flight);
      if (result.ok && !controller.signal.aborted) {
        revision++;
        renewedGeneration = generation;
      }
      return result;
    });
    current = flight;
    return flight;
  }
  return {
    getRevision: () => revision,
    async wait(generation: number, signal: AbortSignal, startedRevision: number): Promise<RequestOutcome<void>> {
      if (signal.aborted) return aborted();
      if (startedRevision !== revision && renewedGeneration === generation) return { ok: true, data: undefined };
      if (current && current.generation !== generation) {
        current.cancel();
        current = undefined;
      }
      const flight = current ?? start(generation);
      flight.waiters++;
      let onAbort!: () => void;
      const cancelled = new Promise<RequestOutcome<void>>(resolve => {
        onAbort = () => resolve(aborted());
        signal.addEventListener('abort', onAbort, { once: true });
      });
      try {
        return await Promise.race([flight.result, cancelled]);
      } finally {
        signal.removeEventListener('abort', onAbort);
        flight.waiters--;
        if (!flight.waiters && !flight.settled) {
          flight.cancel();
          clear(flight);
        }
      }
    },
    dispose() {
      if (current) {
        current.cancel();
        current = undefined;
      }
    },
  };
}
