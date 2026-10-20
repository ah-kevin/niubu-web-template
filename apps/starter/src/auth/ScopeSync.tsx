import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthSnapshot, useStarterAuth } from './context';
import { equalScope, readStarterScope, withScope } from './scope';

export function ScopeSync() {
  const auth = useStarterAuth(),
    state = useAuthSnapshot(),
    location = useLocation(),
    navigate = useNavigate();
  useEffect(() => {
    if (!state.user || state.loginExpired || location.pathname === '/login') return;
    const selected = readStarterScope(location.search, state.user);
    if (!equalScope(state.scope, selected.scope)) void auth.switchScope(selected.scope).catch(() => {});
    if (selected.valid && !selected.explicit && selected.scope)
      void navigate(
        { pathname: location.pathname, search: withScope(location.search, selected.scope), hash: location.hash },
        { replace: true },
      );
  }, [auth, state.user, state.loginExpired, state.scope, location.pathname, location.search, location.hash, navigate]);
  return null;
}
