import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserDropdown, CheckUpdates } from '@niubu/layouts/widgets';
import { Modal, useOverlay } from '@niubu/common-ui/overlay';
import { Input } from '@niubu/shadcn-ui/input';
import { Button } from '@niubu/shadcn-ui/button';
import { useInteractionState } from '@niubu/stores';
import { useAppStores } from '@niubu/stores/react';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot, useStarterAuth } from '../auth/context';
import { withScope } from '../auth/scope';
import { useStarterLockSnapshot, useStarterShell } from './shell-context';

export function ShellActions({ showUpdates = true }: { showUpdates?: boolean } = {}) {
  const stores = useAppStores();
  const shell = useStarterShell(),
    lockState = useStarterLockSnapshot(),
    state = useAuthSnapshot(),
    auth = useStarterAuth(),
    interaction = useInteractionState(),
    overlay = useOverlay(),
    { t } = useTranslation('shell');
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState('');
  const id = useId(),
    operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  function close() {
    operation.current?.abort();
    shell?.lock?.cancel();
    setPassword('');
    setOpen(false);
  }
  async function logout() {
    const original = auth.requestContext(),
      identity = auth.getSnapshot().user?.id;
    if (
      stores.interaction.getSnapshot().dirty &&
      !(await overlay.confirm({
        title: t('user.logoutConfirm'),
        description: t('user.logoutDirty'),
        signal: original.signal,
      }))
    )
      return;
    if (original.signal.aborted || auth.getSnapshot().user?.id !== identity) return;
    try {
      await auth.logout();
    } catch {
      if (!original.signal.aborted) await overlay.alert({ title: t('user.logoutFailed'), signal: original.signal });
    }
  }
  async function lock() {
    if (!shell?.lock || state.status !== 'ready' || state.loginExpired) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const signal = AbortSignal.any([controller.signal, auth.requestContext().signal]),
      phrase = password;
    setPassword('');
    const locked = await shell.lock.lock(phrase, signal);
    if (!signal.aborted && operation.current === controller && locked) {
      setOpen(false);
      operation.current = null;
    }
  }
  if (!state.user) return null;
  const ready = state.status === 'ready' && !state.loginExpired;
  return (
    <>
      <UserDropdown
        displayName={state.user.name}
        profile={{
          href: '/profile' + withScope('', state.scope),
          renderLink: ({ href, ...props }) => (
            <Link
              to={href}
              {...props}
              onClick={event => {
                props.onClick?.(event);
                if (!event.defaultPrevented) stores.ui.update({ mobileOpen: false });
              }}
            />
          ),
        }}
        lock={{
          disabled:
            !ready || !shell?.lock || Boolean(lockState.errorCode && lockState.errorCode !== 'invalid-password'),
          reason: !shell?.lock ? t('user.notConnected') : undefined,
          onSelect: () => {
            setPassword('');
            setOpen(true);
          },
        }}
        logout={{
          disabled: !ready,
          onSelect: () => {
            void logout();
          },
        }}
      />
      {showUpdates && shell && (
        <CheckUpdates
          checker={shell.updates}
          dirty={interaction.dirty}
          onReload={() => {
            if (!interaction.dirty && !shell.lock?.getSnapshot().locked) shell.reloadPage();
          }}
          labels={{
            checking: t('updates.checking'),
            available: t('updates.available'),
            unavailable: t('updates.unavailable'),
            reload: t('updates.reload'),
            dirty: t('updates.dirty'),
          }}
        />
      )}
      <Modal
        open={open}
        onOpenChange={value => {
          if (!value) close();
        }}
        onRequestClose={close}
        title={t('lock.setTitle')}
        description={t('lock.description')}
        footer={null}
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            void lock();
          }}
        >
          <label htmlFor={id}>{t('lock.password')}</label>
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => {
              operation.current?.abort();
              shell?.lock?.cancel();
              setPassword(event.target.value);
            }}
          />
          {lockState.errorCode && (
            <p role="alert">{lockState.errorCode === 'invalid-password' ? t('lock.invalid') : t('lock.unavailable')}</p>
          )}
          <Button type="submit" disabled={!ready || lockState.pending || password.length === 0}>
            {lockState.pending ? t('lock.pending') : t('lock.set')}
          </Button>
        </form>
      </Modal>
    </>
  );
}
