/** Appearance-only metadata. It never restores an identity or grants access. */
export const AUTH_IDENTITY_HINT_KEY = 'playground.auth.identity';
export const AUTH_RESTORE_BLOCKED_KEY = 'playground.auth.restore-blocked';
export function readPlaygroundIdentityHint(storage: Pick<Storage, 'getItem'>): string {
  try {
    if (storage.getItem(AUTH_RESTORE_BLOCKED_KEY) === '1') return 'anonymous';
    const raw = storage.getItem(AUTH_IDENTITY_HINT_KEY);
    if (!raw) return 'anonymous';
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== 1 ||
      !('identityKey' in value)
    )
      return 'anonymous';
    const key = value.identityKey;
    return typeof key === 'string' &&
      key.length > 0 &&
      key.length <= 200 &&
      key.trim() === key &&
      ![...key].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      ? key
      : 'anonymous';
  } catch {
    return 'anonymous';
  }
}
