export type StoragePort = {
  read(key: string): { ok: true; value: string | null } | { ok: false; reason: string };
  write(key: string, value: string): { ok: true } | { ok: false; reason: string };
};
const reason = (error: unknown) => (error instanceof Error ? error.message : 'Storage is unavailable');
/** The only browser-storage adapter. Call-time resolution also works without a DOM. */
export function createStoragePort(storage?: Pick<Storage, 'getItem' | 'setItem'>): StoragePort {
  return {
    read(key) {
      try {
        return { ok: true, value: (storage ?? window.localStorage).getItem(key) };
      } catch (error) {
        return { ok: false, reason: reason(error) };
      }
    },
    write(key, value) {
      try {
        (storage ?? window.localStorage).setItem(key, value);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reason(error) };
      }
    },
  };
}

export type SessionStoragePort = StoragePort & {
  remove(key: string): { ok: true } | { ok: false; reason: string };
};
/** A distinct call-time adapter; preferences continue to use the unchanged local port. */
export function createSessionStoragePort(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SessionStoragePort {
  return {
    read(key) {
      try {
        return { ok: true, value: (storage ?? window.sessionStorage).getItem(key) };
      } catch (error) {
        return { ok: false, reason: reason(error) };
      }
    },
    write(key, value) {
      try {
        (storage ?? window.sessionStorage).setItem(key, value);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reason(error) };
      }
    },
    remove(key) {
      try {
        (storage ?? window.sessionStorage).removeItem(key);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reason(error) };
      }
    },
  };
}
