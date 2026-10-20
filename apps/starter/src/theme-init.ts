import { readPreferenceThemeSnapshot } from '@niubu/preferences/pure';
import { createStoragePort } from '@niubu/hooks/storage';
import { applyThemeSnapshot } from '@niubu/hooks/theme-dom';
import { readStarterIdentityHint } from './auth/identity-hint';
import { appIdentity, appDefaults, appPolicy } from './app/config';

const snapshot = readPreferenceThemeSnapshot({
  storage: createStoragePort(),
  identity: {
    ...appIdentity,
    identityKey: (() => {
      try {
        return readStarterIdentityHint(window.sessionStorage);
      } catch {
        return 'anonymous';
      }
    })(),
  },
  appDefaults,
  policy: appPolicy,
});
let dark = false;
if (snapshot.mode === 'system') {
  try {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    /* Main runtime recovers. */
  }
}
applyThemeSnapshot(document.documentElement, snapshot, dark);
