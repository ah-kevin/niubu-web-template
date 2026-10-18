// Explicit test-only identity contract; shared tooling must not discover an app's configuration.
export const fixtureIdentity = Object.freeze({
  storageNamespace: 'theme-fixture',
  product: 'fixture',
  appId: 'theme-fixture',
  environment: 'contract-test',
  identityKey: 'anonymous',
});
export const hintKey = 'theme-fixture.auth.identity';
export const blockedKey = 'theme-fixture.auth.restore-blocked';
const expectedKey = identityKey =>
  `${fixtureIdentity.storageNamespace}.preferences:` +
  encodeURIComponent(
    JSON.stringify([fixtureIdentity.product, fixtureIdentity.appId, fixtureIdentity.environment, identityKey, null]),
  );
export const themeContract = {
  appId: fixtureIdentity.appId,
  environment: fixtureIdentity.environment,
  hintedKey: expectedKey('fixture-user'),
  anonymousKey: expectedKey('anonymous'),
  hintKey,
  blockedKey,
};

// The fixture supplies appearance-only metadata; it never authenticates a session.
export function readFixtureIdentityHint(storage) {
  try {
    if (storage.getItem(blockedKey) === '1') return 'anonymous';
    const value = JSON.parse(storage.getItem(hintKey));
    if (!value || typeof value !== 'object' || value.version !== 1) return 'anonymous';
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
