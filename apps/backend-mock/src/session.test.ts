import { expect, it } from 'vitest';
import { createSessionStore } from './session';

it('tracks access expiry independently from refresh expiry', () => {
  let time = 0;
  const sessions = createSessionStore({ now: () => time });
  const tokens = sessions.issue('synthetic');
  expect(sessions.authenticate(tokens.accessToken)).toEqual({ kind: 'valid', userId: 'synthetic' });
  time = 300_000;
  expect(sessions.authenticate(tokens.accessToken)).toEqual({ kind: 'expired' });
  expect(sessions.refresh(tokens.refreshToken)).toMatchObject({ refreshToken: tokens.refreshToken });
  time = 604_800_000;
  expect(sessions.refresh(tokens.refreshToken)).toBeNull();
});

it('does not revoke another session when logout includes a mismatched refresh token', () => {
  const sessions = createSessionStore();
  const first = sessions.issue('one');
  const second = sessions.issue('two');
  sessions.revoke({ accessToken: first.accessToken, refreshToken: second.refreshToken });
  expect(sessions.authenticate(first.accessToken)).toEqual({ kind: 'missing' });
  expect(sessions.authenticate(second.accessToken)).toEqual({ kind: 'valid', userId: 'two' });
});

it('revokes all access and refresh tokens on dispose', () => {
  const sessions = createSessionStore();
  const token = sessions.issue('synthetic');
  expect(sessions.authenticate(token.accessToken)).toEqual({ kind: 'valid', userId: 'synthetic' });
  sessions.dispose();
  expect(sessions.authenticate(token.accessToken)).toEqual({ kind: 'missing' });
  expect(sessions.refresh(token.refreshToken)).toBeNull();
});
