import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { ExampleSection } from '../examples/ExamplePage';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@niubu/locales/react';
import type { AuthContext } from '@niubu/types';
import type { RequestError, UploadProgress, UploadSource } from '@niubu/request';
import { usePlaygroundApi } from '../app/api-context';
import { useAuthSnapshot, usePlaygroundAuth } from '../auth/context';
import type { TransferFile } from './contracts';
import { sameTransferContext, snapshotTransferContext } from './lease';
import { saveDownload, type SaveDownloadPorts } from './save-download';

const browserDownloadPorts: SaveDownloadPorts = {
  createObjectURL: blob => URL.createObjectURL(blob),
  revokeObjectURL: url => URL.revokeObjectURL(url),
  activate(url, filename) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  },
  scheduleRelease(release) {
    const handle = globalThis.setTimeout(release, 0);
    return () => globalThis.clearTimeout(handle);
  },
};
type Operation = { context: AuthContext; session: AbortSignal; controller: AbortController; signal: AbortSignal };
type View = {
  context: AuthContext;
  busy?: 'upload' | 'download';
  progress?: UploadProgress;
  file?: TransferFile;
  message?: string;
  alert?: boolean;
};
function uploadMessage(error: RequestError): string {
  if (error.kind === 'aborted') return 'transfer.cancelled';
  if (error.code === 'TRANSFER_RECONFIRM') return 'transfer.reconfirm';
  if (error.status === 403) return 'transfer.forbidden';
  if (error.kind === 'not-enabled') return 'transfer.unavailable';
  return 'transfer.failed';
}

/** The component stays mounted across scope/generation changes; its selected File is local UI state. */
export function TransferDemo({ downloadPorts = browserDownloadPorts }: { downloadPorts?: SaveDownloadPorts } = {}) {
  const { t } = useTranslation('app');
  const api = usePlaygroundApi();
  const auth = usePlaygroundAuth();
  const snapshot = useAuthSnapshot();
  const id = useId();
  const [selected, setSelected] = useState<File | null>(null);
  const [view, setView] = useState<View | null>(null);
  const operation = useRef<Operation | null>(null);
  const releaseDownload = useRef<(() => void) | undefined>(undefined);
  const session = auth.requestContext().signal;
  const context = api.getContext();
  const ready = Boolean(
    api.transfers &&
    context &&
    snapshot.user &&
    snapshot.status === 'ready' &&
    !snapshot.loginExpired &&
    !session.aborted &&
    snapshot.user.id === context.identityKey &&
    snapshot.generation === context.generation &&
    snapshot.scope?.kind === context.scope?.kind &&
    snapshot.scope?.id === context.scope?.id &&
    context.scope?.kind === 'workspace',
  );
  const permitted = ready && snapshot.codes.includes('demo:transfer');
  const visible = permitted && context && view && sameTransferContext(view.context, context) ? view : null;
  const tooLarge = Boolean(selected && selected.size > 1_048_576);

  function retire() {
    const previous = operation.current;
    operation.current = null;
    previous?.controller.abort();
    releaseDownload.current?.();
    releaseDownload.current = undefined;
  }
  useEffect(() => {
    const abort = () => {
      const previous = operation.current;
      operation.current = null;
      previous?.controller.abort();
      releaseDownload.current?.();
      releaseDownload.current = undefined;
      setView(null);
    };
    session.addEventListener('abort', abort, { once: true });
    return () => {
      session.removeEventListener('abort', abort);
      const previous = operation.current;
      operation.current = null;
      previous?.controller.abort();
      releaseDownload.current?.();
      releaseDownload.current = undefined;
    };
  }, [session, permitted, api.transfers]);

  function active(current: Operation) {
    const state = auth.getSnapshot();
    return (
      operation.current === current &&
      !current.signal.aborted &&
      !current.session.aborted &&
      auth.requestContext().signal === current.session &&
      state.status === 'ready' &&
      !state.loginExpired &&
      state.user?.id === current.context.identityKey &&
      state.generation === current.context.generation &&
      state.codes.includes('demo:transfer') &&
      sameTransferContext(current.context, api.getContext())
    );
  }
  function begin(): Operation | null {
    retire();
    const state = auth.getSnapshot();
    const live = api.getContext();
    const capturedSession = auth.requestContext().signal;
    if (
      !api.transfers ||
      !live ||
      live.scope?.kind !== 'workspace' ||
      !live.scope.id ||
      !state.user ||
      state.status !== 'ready' ||
      state.loginExpired ||
      !state.codes.includes('demo:transfer') ||
      state.user.id !== live.identityKey ||
      state.generation !== live.generation ||
      capturedSession.aborted
    )
      return null;
    const controller = new AbortController();
    const current = {
      context: snapshotTransferContext(live),
      session: capturedSession,
      controller,
      signal: AbortSignal.any([controller.signal, capturedSession]),
    };
    operation.current = current;
    return current;
  }
  async function upload() {
    if (!selected || selected.size > 1_048_576) return;
    const current = begin();
    if (!current) return;
    const chosen = selected;
    const initial: UploadProgress = { acknowledgedBytes: 0, totalBytes: chosen.size, phase: 'uploading' };
    setView({ context: current.context, busy: 'upload', progress: initial });
    const source: UploadSource = {
      name: chosen.name,
      size: chosen.size,
      contentType: chosen.type,
      async read(start, end, signal) {
        if (signal.aborted || !active(current)) throw new DOMException('Transfer cancelled', 'AbortError');
        const bytes = await chosen.slice(start, end).arrayBuffer();
        if (signal.aborted || !active(current)) throw new DOMException('Transfer cancelled', 'AbortError');
        return new Uint8Array(bytes);
      },
    };
    try {
      const result = await api.transfers.upload(current.context, source, {
        signal: current.signal,
        onProgress: progress => {
          if (active(current)) setView({ context: current.context, busy: 'upload', progress });
        },
      });
      if (!active(current)) return;
      operation.current = null;
      setView(
        result.ok
          ? {
              context: current.context,
              file: result.data,
              progress: { acknowledgedBytes: chosen.size, totalBytes: chosen.size, phase: 'complete' },
            }
          : { context: current.context, message: uploadMessage(result.error), alert: result.error.kind !== 'aborted' },
      );
    } catch {
      if (!active(current)) return;
      operation.current = null;
      setView({ context: current.context, message: 'transfer.failed', alert: true });
    }
  }
  function cancel() {
    const previous = operation.current;
    retire();
    if (previous) setView({ context: previous.context, message: 'transfer.cancelled' });
  }
  async function download() {
    const completed = visible?.file;
    if (!completed) return;
    const current = begin();
    if (!current || !visible || !sameTransferContext(visible.context, current.context)) return;
    setView({ ...visible, busy: 'download', message: undefined, alert: undefined });
    try {
      const result = await api.transfers.download(current.context, completed.id, current.signal);
      if (!active(current)) return;
      if (result.ok) {
        const release = saveDownload(result.data, downloadPorts);
        if (!active(current)) {
          release();
          return;
        }
        releaseDownload.current = release;
        setView({ ...visible, busy: undefined, message: undefined, alert: undefined });
      } else
        setView({
          ...visible,
          busy: undefined,
          message: result.error.kind === 'aborted' ? 'transfer.cancelled' : 'transfer.downloadFailed',
          alert: result.error.kind !== 'aborted',
        });
      operation.current = null;
    } catch {
      if (!active(current)) return;
      operation.current = null;
      setView({ ...visible, busy: undefined, message: 'transfer.downloadFailed', alert: true });
    }
  }
  const progress = visible?.progress;
  const progressText =
    progress &&
    t('transfer.acknowledged', { acknowledgedBytes: progress.acknowledgedBytes, totalBytes: progress.totalBytes });
  return (
    <ExampleSection
      title={t('transfer.title')}
      description={t('transfer.description')}
      className="transfer-demo"
      bodyClassName="text-sm"
    >
      <label htmlFor={id}>{t('transfer.file')}</label>
      <Input
        id={id}
        type="file"
        className="h-auto min-h-[var(--workspace-control-height)] max-w-full min-w-0 py-2 file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:text-foreground"
        disabled={!permitted || Boolean(visible?.busy)}
        onChange={event => {
          retire();
          setSelected(event.target.files?.[0] ?? null);
          setView(null);
        }}
      />
      <div className="transfer-actions flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!permitted || !selected || tooLarge || Boolean(visible?.busy)}
          onClick={() => void upload()}
        >
          {t('transfer.upload')}
        </Button>
        {visible?.busy === 'upload' && (
          <Button type="button" variant="outline" onClick={cancel}>
            {t('transfer.cancel')}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!permitted || !visible?.file || Boolean(visible.busy)}
          onClick={() => void download()}
        >
          {t('transfer.download')}
        </Button>
      </div>
      {!ready ? <p>{t('transfer.unavailable')}</p> : !permitted ? <p>{t('transfer.forbidden')}</p> : null}
      {!selected && permitted && <p>{t('transfer.chooseFile')}</p>}
      {tooLarge && <p role="alert">{t('transfer.limit')}</p>}
      {progress && (
        <div className="transfer-progress mt-4 [&_progress]:w-full [&_progress]:max-w-lg [&_progress]:accent-primary">
          <progress
            aria-label={progressText || undefined}
            max={progress.totalBytes || 1}
            value={progress.totalBytes ? progress.acknowledgedBytes : visible?.file ? 1 : 0}
          />
          <p>{progressText}</p>
          {!visible?.file && progress.phase !== 'uploading' && <p role="status">{t('transfer.completing')}</p>}
        </div>
      )}
      {visible?.file && <p role="status">{t('transfer.complete')}</p>}
      {visible?.message && (
        <p className="transfer-status [&[role=alert]]:text-destructive" role={visible.alert ? 'alert' : 'status'}>
          {t(visible.message)}
        </p>
      )}
    </ExampleSection>
  );
}
