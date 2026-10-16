import type { RequestClient } from './types';
/** Shared disabled implementation; this entry never imports enabled transport. */
export function createDisabledRequestClient(_options: { mode: 'disabled' }): RequestClient {
  return {
    mode: 'disabled',
    async execute() {
      return { ok: false, error: { kind: 'not-enabled' } };
    },
    dispose() {},
  };
}
