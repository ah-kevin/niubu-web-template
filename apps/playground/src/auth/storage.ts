import { createSessionStoragePort } from '@niubu/hooks';
import type { AuthStorage } from './adapter';
export function browserAuthStorage(): AuthStorage {
  const port = createSessionStoragePort();
  return {
    getItem(key) {
      const result = port.read(key);
      if (!result.ok) throw new Error('Authentication storage unavailable');
      return result.value;
    },
    setItem(key, value) {
      const result = port.write(key, value);
      if (!result.ok) throw new Error('Authentication storage unavailable');
    },
    removeItem(key) {
      const result = port.remove(key);
      if (!result.ok) throw new Error('Authentication storage unavailable');
    },
  };
}
