/** Private delayed, abortable synthetic GET fixture. No transport or account is accessed. */
export type SyntheticContext = Readonly<{ identity: string; scope: string; generation: number }>;
export function syntheticKey(context: SyntheticContext) {
  return ['playground-features', context.identity, context.scope, context.generation] as const;
}
export const contextLabel = (context: SyntheticContext) =>
  `${context.identity} / ${context.scope} / ${context.generation}`;

async function delay(signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Synthetic GET aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 80);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      signal.removeEventListener('abort', abort);
      abort();
    }
  });
}
export class SyntheticGetError extends Error {}
export function createQueryFixture() {
  const attempts = new Map<string, number>();
  return {
    async get<T>(key: readonly unknown[], signal: AbortSignal, value: T, failure: 'once' | 'always' | 'none' = 'none') {
      const serialized = JSON.stringify(key);
      const count = (attempts.get(serialized) ?? 0) + 1;
      attempts.set(serialized, count);
      await delay(signal);
      if (failure === 'always' || (failure === 'once' && count === 1))
        throw new SyntheticGetError(`合成 GET 持续失败；尝试：${count}`);
      return { value, attempts: count };
    },
    retire(prefix: readonly unknown[]) {
      for (const key of attempts.keys()) {
        const parts: unknown[] = JSON.parse(key);
        if (prefix.every((part, index) => parts[index] === part)) attempts.delete(key);
      }
    },
    clear: () => attempts.clear(),
  };
}
export type QueryFixture = ReturnType<typeof createQueryFixture>;
