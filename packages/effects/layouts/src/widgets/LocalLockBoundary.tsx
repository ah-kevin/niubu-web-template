import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { LocalLock } from '@niubu/hooks';
import { BusinessPortalBoundary, LocalLockPortalHost } from '@niubu/shadcn-ui/business-portal-boundary';
import { Dialog, DialogContent, DialogTitle } from '@niubu/shadcn-ui/dialog';
import { Input } from '@niubu/shadcn-ui/input';
import { Button } from '@niubu/shadcn-ui/button';

export type LockLabels = {
  title: string;
  password: string;
  unlock: string;
  pending: string;
  invalid: string;
  unavailable: string;
};
function LockScreen({ owner, labels }: { owner: LocalLock; labels: LockLabels }) {
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const [password, setPassword] = useState('');
  const current = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(
    () => () => {
      current.current?.abort();
    },
    [],
  );
  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        <DialogTitle>{labels.title}</DialogTitle>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (snapshot.pending) return;
            current.current?.abort();
            const controller = new AbortController();
            current.current = controller;
            const phrase = password;
            setPassword('');
            void owner.unlock(phrase, controller.signal);
          }}
        >
          <label htmlFor={id}>{labels.password}</label>
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          {snapshot.errorCode && (
            <p role="alert">{snapshot.errorCode === 'invalid-password' ? labels.invalid : labels.unavailable}</p>
          )}
          <Button type="submit" disabled={snapshot.pending}>
            {snapshot.pending ? labels.pending : labels.unlock}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Keeps business identity, router and form owners mounted during local lock and same-user reauth. */
export function LocalLockBoundary({
  owner,
  children,
  labels,
  reauthentication,
}: {
  owner: LocalLock;
  children: ReactNode;
  labels: LockLabels;
  reauthentication?: { active: boolean; content: ReactNode };
}) {
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const reauth = reauthentication?.active ?? false;
  return (
    <>
      <BusinessPortalBoundary locked={snapshot.locked || reauth}>{children}</BusinessPortalBoundary>
      <LocalLockPortalHost kind="lock" active={snapshot.locked && !reauth}>
        <LockScreen owner={owner} labels={labels} />
      </LocalLockPortalHost>
      <LocalLockPortalHost kind="reauth" active={reauth}>
        {reauthentication?.content}
      </LocalLockPortalHost>
    </>
  );
}
