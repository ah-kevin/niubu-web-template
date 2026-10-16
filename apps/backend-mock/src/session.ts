const ACCESS_TTL_MS = 300_000;
const REFRESH_TTL_MS = 604_800_000;
const MAX_SESSIONS = 128;

interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export function createSessionStore(options: { now?: () => number; randomId?: () => string } = {}) {
  const now = options.now ?? Date.now;
  const randomId = options.randomId ?? (() => globalThis.crypto.randomUUID());
  const sessions = new Map<string, Session>();
  const access = new Map<string, string>();
  let sequence = 0;

  // A local counter also prevents collisions when a deterministic injected id repeats.
  const token = (kind: string) => `${kind}_${++sequence}_${randomId()}`;
  function remove(refreshToken: string) {
    const session = sessions.get(refreshToken);
    if (session) access.delete(session.accessToken);
    sessions.delete(refreshToken);
  }
  function pair(session: Session): TokenPair {
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TTL_MS / 1_000,
    };
  }
  function prune() {
    for (const session of sessions.values()) {
      if (now() >= session.refreshExpiresAt) remove(session.refreshToken);
    }
  }

  return {
    issue(userId: string): TokenPair {
      prune();
      if (sessions.size >= MAX_SESSIONS) remove(sessions.keys().next().value!);
      const session: Session = {
        userId,
        accessToken: token('access'),
        refreshToken: token('refresh'),
        accessExpiresAt: now() + ACCESS_TTL_MS,
        refreshExpiresAt: now() + REFRESH_TTL_MS,
      };
      sessions.set(session.refreshToken, session);
      access.set(session.accessToken, session.refreshToken);
      return pair(session);
    },
    authenticate(token: string): { kind: 'valid'; userId: string } | { kind: 'missing' | 'expired' } {
      const session = sessions.get(access.get(token) ?? '');
      if (!session) return { kind: 'missing' };
      if (now() >= session.accessExpiresAt) return { kind: 'expired' };
      return { kind: 'valid', userId: session.userId };
    },
    refresh(refreshToken: string): TokenPair | null {
      prune();
      const session = sessions.get(refreshToken);
      if (!session) return null;
      access.delete(session.accessToken);
      session.accessToken = token('access');
      session.accessExpiresAt = now() + ACCESS_TTL_MS;
      access.set(session.accessToken, session.refreshToken);
      return pair(session);
    },
    revoke(tokens: { accessToken?: string; refreshToken?: string }) {
      // If access identifies a session, a mismatched body token must not revoke another one.
      const refreshToken = access.get(tokens.accessToken ?? '') ?? tokens.refreshToken;
      if (refreshToken) remove(refreshToken);
    },
    dispose() {
      access.clear();
      sessions.clear();
    },
  };
}
