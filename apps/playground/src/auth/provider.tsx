import { useSyncExternalStore, type ReactNode } from 'react';
import { AccessProvider } from '@niubu/access/react';
import { PlaygroundAuthContext, type PlaygroundAuth } from './context';
export function PlaygroundAuthProvider({ auth, children }: { auth: PlaygroundAuth; children: ReactNode }) {
  const state = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
  return (
    <PlaygroundAuthContext value={auth}>
      <AccessProvider
        value={{
          codes: state.codes,
          roles: state.user?.roles ?? [],
          ready: state.status === 'ready' && !state.loginExpired,
        }}
      >
        {children}
      </AccessProvider>
    </PlaygroundAuthContext>
  );
}
