import { useSyncExternalStore, type ReactNode } from 'react';
import { AccessProvider } from '@niubu/access/react';
import { StarterAuthContext, type StarterAuth } from './context';
export function StarterAuthProvider({ auth, children }: { auth: StarterAuth; children: ReactNode }) {
  const state = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
  return (
    <StarterAuthContext value={auth}>
      <AccessProvider
        value={{
          codes: state.codes,
          roles: state.user?.roles ?? [],
          ready: state.status === 'ready' && !state.loginExpired,
        }}
      >
        {children}
      </AccessProvider>
    </StarterAuthContext>
  );
}
