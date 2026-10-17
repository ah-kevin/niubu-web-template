import { DocumentationLink } from '../DocumentationLink';
import { useFeedbackText } from './copy';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { ControlledField, useSchemaForm } from '@niubu/common-ui/form';
import { Drawer, Modal, OverlayProvider, useOverlay } from '@niubu/common-ui/overlay';
import { ReadState } from '@niubu/common-ui/read-state';
import { SystemStatePage } from '@niubu/common-ui/system-state';
import { RouteErrorBoundary, RoutePending } from '@niubu/layouts/routing';
import { Button } from '@niubu/shadcn-ui/button';
import { CircleAlert } from '@niubu/icons';

export type ExampleRecord = { id: string; name: string };
export type FeedbackPageProps = {
  saveRecord?: (record: ExampleRecord, context: { signal: AbortSignal }) => Promise<void>;
};
type Kind = 'Modal' | 'Drawer';
const initialRecord: ExampleRecord = { id: 'demo-7', name: 'Ada' };

/** Local simulated work; aborting an owner also clears its timer. No request or login state is used. */
function simulateSave(_record: ExampleRecord, { signal }: { signal: AbortSignal }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 600);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function RecordEditor({
  kind,
  record,
  onRecordChange,
  onClose,
  onSaved,
  saveRecord,
}: {
  kind: Kind;
  record: ExampleRecord;
  onRecordChange: (record: ExampleRecord) => void;
  onClose: () => void;
  onSaved: (record: ExampleRecord) => void;
  saveRecord: NonNullable<FeedbackPageProps['saveRecord']>;
}) {
  const { t } = useFeedbackText();
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const schema = useSchemaForm<{ name: string }, ExampleRecord>({
    defaultValues: { name: record.name },
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true, schema: z.string().trim().min(1, 'Enter a name') },
    ],
    transform: values => ({ id: record.id, name: values.name ?? '' }),
    onSubmit: async (value, context) => {
      await saveRecord(value, context);
      if (mounted.current && !context.signal.aborted) onSaved(value);
    },
  });
  const Shell = kind === 'Modal' ? Modal : Drawer;
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFailed(false);
    const result = await schema.submit();
    submitting.current = false;
    if (mounted.current) {
      setPending(false);
      setFailed(result === 'error');
      if (result === 'invalid') schema.form.setFocus('name');
    }
  }
  function close() {
    schema.cancel();
    onClose();
  }
  return (
    <Shell
      open
      onOpenChange={open => {
        if (!open) close();
      }}
      onRequestClose={close}
      title={t('editorTitle', { kind, name: record.name })}
      description={t('editorHelp')}
      fullscreen={fullscreen}
      confirmLoading={pending}
      confirmLabel={t('save')}
      cancelLabel={t('cancel')}
      onConfirm={() => {
        void submit();
      }}
    >
      <p>{record.id}</p>
      <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
        <Button type="button" variant="outline" onClick={() => setFullscreen(value => !value)}>
          {t('fullscreen')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            const next = { ...record, name: 'Grace' };
            schema.setValues({ name: next.name });
            onRecordChange(next);
          }}
        >
          {t('shared')}
        </Button>
      </div>
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={pending}>
          <legend>{t('record')}</legend>
          <ControlledField
            control={schema.form.control}
            name="name"
            kind="text"
            label={t('name')}
            required
            resolveMessage={message => (message === 'Enter a name' ? t('nameError') : message)}
          />
        </fieldset>
        <Button type="submit" variant="outline" disabled={pending}>
          {t('submit')}
        </Button>
      </form>
      {failed && <p role="alert">{t('saveFailed')}</p>}
      <details>
        <summary>{t('scroll')}</summary>
        {Array.from({ length: 24 }, (_, index) => (
          <p key={index}>{t('contentRow', { row: index + 1 })}</p>
        ))}
      </details>
    </Shell>
  );
}

const states = {
  '403': { heading: 'Access denied', description: 'Static forbidden-page example.' },
  '404': { heading: 'Page not found', description: 'Static missing-page example.' },
  '500': { heading: 'Server error', description: 'Static error presentation; no exception is thrown.' },
  Offline: { heading: 'Offline example', description: 'Static illustration only; no network detection.' },
} as const;

/** Queued React content follows locale changes without replacing its queue entry. */
function FeedbackMessage({ source }: { source: string }) {
  const { localize } = useFeedbackText();
  return <>{localize(source)}</>;
}

function FeedbackExamples({ saveRecord = simulateSave }: FeedbackPageProps) {
  const { t, localize } = useFeedbackText();
  const [kind, setKind] = useState<Kind | null>(null);
  const [record, setRecord] = useState(initialRecord);
  const [saved, setSaved] = useState<ExampleRecord | null>(null);
  const [queueResult, setQueueResult] = useState('No queue result');
  const [readStatus, setReadStatus] = useState<'loading' | 'error' | 'empty'>('loading');
  const [readAction, setReadAction] = useState('No read action');
  const [pendingRoute, setPendingRoute] = useState(false);
  const [state, setState] = useState<keyof typeof states>('403');
  const [stateAction, setStateAction] = useState('No state action');
  const queueOwner = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    queueOwner.current = controller;
    return () => {
      controller.abort();
    };
  }, []);
  const overlay = useOverlay();
  async function queue() {
    const signal = queueOwner.current?.signal;
    if (!signal || signal.aborted) return;
    const confirmation = overlay.confirm({
      title: <FeedbackMessage source="Confirm sample" />,
      description: <FeedbackMessage source="Synthetic confirmation queued before an alert." />,
      signal,
    });
    const alert = overlay.alert({
      title: <FeedbackMessage source="Queued alert" />,
      description: <FeedbackMessage source="Second item in the local queue." />,
      signal,
    });
    const confirmed = await confirmation;
    await alert;
    if (!signal.aborted) setQueueResult(`${confirmed ? 'Confirmed' : 'Cancelled'} · alert completed`);
  }
  return (
    <main className="example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[12px] [&>h1]:text-[24px] [&>h1]:font-semibold [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-semibold">
      <h1>{t('title')}</h1>
      <DocumentationLink kind="overlay" />
      <p>{t('help')}</p>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('overlays')}</h2>
        <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
          {(['Modal', 'Drawer'] as const).map(value => (
            <Button key={value} type="button" onClick={() => setKind(value)}>
              {t('open', { kind: value })}
            </Button>
          ))}
        </div>
        <output aria-label={t('savedRecord')}>{saved ? `${saved.id} · ${saved.name}` : t('nothingSaved')}</output>
        {kind && (
          <RecordEditor
            kind={kind}
            record={record}
            onRecordChange={setRecord}
            saveRecord={saveRecord}
            onClose={() => setKind(null)}
            onSaved={value => {
              setSaved(value);
              setRecord(value);
              setKind(null);
            }}
          />
        )}
      </section>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('queue')}</h2>
        <Button
          type="button"
          onClick={() => {
            void queue();
          }}
        >
          {t('queueButton')}
        </Button>
        <output aria-label={t('queueResult')}>{localize(queueResult)}</output>
      </section>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('reading')}</h2>
        <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
          <Button type="button" onClick={() => setReadStatus('loading')}>
            {t('showLoading')}
          </Button>
          <Button type="button" onClick={() => setReadStatus('error')}>
            {t('showError')}
          </Button>
          <Button type="button" onClick={() => setReadStatus('empty')}>
            {t('showEmpty')}
          </Button>
        </div>
        <div aria-label={t('readExample')}>
          <ReadState
            status={readStatus}
            onRetry={() => {
              setReadAction('Retried');
              setReadStatus('loading');
            }}
            onReset={() => {
              setReadAction('Filters reset');
              setReadStatus('loading');
            }}
            onNavigate={() => setReadAction('Returned to sample')}
          />
        </div>
        <output aria-label={t('readAction')}>{localize(readAction)}</output>
        <Button type="button" variant="outline" onClick={() => setPendingRoute(value => !value)}>
          {pendingRoute ? t('hidePending') : t('showPending')}
        </Button>
        <div aria-label={t('pendingExample')}>{pendingRoute && <RoutePending />}</div>
      </section>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('states')}</h2>
        <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
          {(Object.keys(states) as (keyof typeof states)[]).map(value => (
            <Button key={value} type="button" variant="outline" onClick={() => setState(value)}>
              {t('showState', { state: value === 'Offline' ? t('offline') : value })}
            </Button>
          ))}
        </div>
        <p>{t('boundaryHelp')}</p>
        <RouteErrorBoundary title={t('stateTitle')} appTitle={t('appTitle')}>
          <SystemStatePage
            code={state}
            heading={localize(states[state].heading)}
            description={localize(states[state].description)}
            icon={<CircleAlert aria-hidden="true" />}
            footer={t('footer')}
            actions={[{ id: 'return', label: t('return'), onClick: () => setStateAction('Returned to sample') }]}
          />
        </RouteErrorBoundary>
        <output aria-label={t('stateAction')}>{localize(stateAction)}</output>
      </section>
    </main>
  );
}

export function FeedbackPage(props: FeedbackPageProps) {
  return (
    <OverlayProvider>
      <FeedbackExamples {...props} />
    </OverlayProvider>
  );
}
