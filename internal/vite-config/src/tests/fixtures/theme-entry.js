import { readPreferenceThemeSnapshot } from '@niubu/preferences/pure';
import { createStoragePort } from '@niubu/hooks/storage';
import { applyThemeSnapshot } from '@niubu/hooks/theme-dom';
import { fixtureIdentity, readFixtureIdentityHint } from './theme-contract.js';

// Browser composition fixture: exercise the real public prepaint helpers with explicit inputs.
const snapshot = readPreferenceThemeSnapshot({
  storage: createStoragePort(),
  identity: {
    ...fixtureIdentity,
    identityKey: (() => {
      try {
        return readFixtureIdentityHint(window.sessionStorage);
      } catch {
        return 'anonymous';
      }
    })(),
  },
  appDefaults: { theme: { mode: 'system' } },
  policy: {},
});
let dark = false;
if (snapshot.mode === 'system') {
  try {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    /* Runtime can recover. */
  }
}
applyThemeSnapshot(document.documentElement, snapshot, dark);
