import { DataTable, createDataTableLabels } from '@niubu/common-ui/data-table';
import { useTranslation } from '@niubu/locales/react';
import { DocumentationLink } from '../DocumentationLink';
import { useFeedbackText } from './copy';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { ControlledField, useSchemaForm } from '@niubu/common-ui/form';
import { Drawer, Modal, OverlayProvider, useOverlay } from '@niubu/common-ui/overlay';
import { QuickView } from '@niubu/common-ui/quick-view';
import { ReturnPathProvider } from '@niubu/common-ui/return-path';
import { ActionPreview } from '@niubu/common-ui/action-preview';
import { Input } from '@niubu/shadcn-ui/input';
import { Label } from '@niubu/shadcn-ui/label';
import { ReadState } from '@niubu/common-ui/read-state';
import { SystemStatePage } from '@niubu/common-ui/system-state';
import { RouteErrorBoundary, RoutePending } from '@niubu/layouts/routing';
import { Button } from '@niubu/shadcn-ui/button';
import { CircleAlert, ClipboardList, ListChecks, Maximize } from '@niubu/icons';
import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';

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
  const scrollContent = useRef<HTMLDetailsElement>(null);
  const firstContent = useRef<HTMLParagraphElement>(null);
  const lastContent = useRef<HTMLParagraphElement>(null);
  function revealContent(target: HTMLParagraphElement | null) {
    if (scrollContent.current) scrollContent.current.open = true;
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }
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
      size="wide"
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
      <div className="mb-5 flex items-center gap-3 rounded-[var(--radius)] border border-border p-4">
        <ClipboardList aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{record.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{record.id}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('fullscreen')}
          onClick={() => setFullscreen(value => !value)}
        >
          <Maximize aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
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
        <fieldset className="mb-4 grid gap-4" disabled={pending}>
          <legend className="mb-3 text-sm font-medium">{t('record')}</legend>
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
      {failed && (
        <p
          className="mt-4 rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {t('saveFailed')}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => revealContent(firstContent.current)}>
          {t('jumpFirst')}
        </Button>
        <Button type="button" variant="outline" onClick={() => revealContent(lastContent.current)}>
          {t('jumpLast')}
        </Button>
      </div>
      <details
        ref={scrollContent}
        className="mt-4 rounded-lg border border-border p-3 [&_p]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium"
      >
        <summary>{t('scroll')}</summary>
        {Array.from({ length: 24 }, (_, index) => (
          <p
            key={index}
            ref={index === 0 ? firstContent : index === 23 ? lastContent : undefined}
            tabIndex={index === 0 || index === 23 ? -1 : undefined}
          >
            {t('contentRow', { row: index + 1 })}
          </p>
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

function SupplementalOverlays() {
  const { t } = useFeedbackText();
  const [quickOpen, setQuickOpen] = useState(false);
  const [draftName, setDraftName] = useState(initialRecord.name);
  const quickTrigger = useRef<HTMLButtonElement>(null);
  const draftId = useId();
  // This synthetic record resolves only to its existing demo route and current scope query.
  const detailHref = '/examples/feedback' + window.location.search;
  return (
    <>
      <ExampleSection title={t('quickTitle')} description={t('quickHelp')}>
        <Button ref={quickTrigger} type="button" variant="outline" onClick={() => setQuickOpen(true)}>
          {t('quickOpen')}
        </Button>
        <ReturnPathProvider resolveReturnPath={() => detailHref}>
          <QuickView
            open={quickOpen}
            onOpenChange={setQuickOpen}
            title={t('quickTitle')}
            description={t('quickHelp')}
            detailHref={detailHref}
            returnFocusRef={quickTrigger}
            dirty={draftName !== initialRecord.name}
          >
            <Label htmlFor={draftId} className="mb-2">
              {t('draftName')}
            </Label>
            <Input id={draftId} value={draftName} onChange={event => setDraftName(event.target.value)} />
          </QuickView>
        </ReturnPathProvider>
      </ExampleSection>
      <ExampleSection title={t('previewTitle')} description={t('previewHelp')}>
        <ActionPreview valid label={t('previewOpen')} title={t('previewTitle')}>
          <p>
            {initialRecord.name} · {initialRecord.id}
          </p>
        </ActionPreview>
      </ExampleSection>
    </>
  );
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
    <ExamplePage title={t('title')} description={t('pageDescription')} actions={<DocumentationLink kind="overlay" />}>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <ExampleSection
          title={t('overlays')}
          description={t('overlaysHelp')}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setKind('Drawer')}>
                {t('open', { kind: 'Drawer' })}
              </Button>
              <Button type="button" onClick={() => setKind('Modal')}>
                {t('open', { kind: 'Modal' })}
              </Button>
            </>
          }
        >
          <div className="flex min-h-20 items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
              <ClipboardList aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{record.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{record.id}</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('savedRecord')}</p>
            <output className="block break-words text-sm" aria-live="polite" aria-label={t('savedRecord')}>
              {saved ? `${saved.id} · ${saved.name}` : t('nothingSaved')}
            </output>
          </div>
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
        </ExampleSection>
        <ExampleSection
          title={t('queue')}
          description={t('queueHelp')}
          footer={
            <Button
              type="button"
              onClick={() => {
                void queue();
              }}
            >
              {t('queueButton')}
            </Button>
          }
        >
          <div className="flex min-h-20 items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
              <ListChecks aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">{t('confirmTitle')}</p>
              <p className="mt-1 text-muted-foreground">{t('alertTitle')}</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('queueResult')}</p>
            <output className="block break-words text-sm" aria-live="polite" aria-label={t('queueResult')}>
              {localize(queueResult)}
            </output>
          </div>
        </ExampleSection>
        <SupplementalOverlays />
        <TableReadFeedbackExample />
        <ExampleSection title={t('reading')}>
          <div className="flex flex-wrap gap-2">
            {(['loading', 'error', 'empty'] as const).map(value => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={readStatus === value ? 'secondary' : 'outline'}
                aria-pressed={readStatus === value}
                onClick={() => setReadStatus(value)}
              >
                {t(value === 'loading' ? 'showLoading' : value === 'error' ? 'showError' : 'showEmpty')}
              </Button>
            ))}
          </div>
          <div
            className="flex min-h-80 items-center justify-center rounded-[var(--radius)] border border-border"
            aria-label={t('readExample')}
          >
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
          <output
            className="block break-words text-sm text-muted-foreground"
            aria-live="polite"
            aria-label={t('readAction')}
          >
            {localize(readAction)}
          </output>
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button type="button" size="sm" variant="outline" onClick={() => setPendingRoute(value => !value)}>
              {pendingRoute ? t('hidePending') : t('showPending')}
            </Button>
            <div className="min-h-6" aria-label={t('pendingExample')}>
              {pendingRoute && <RoutePending />}
            </div>
          </div>
        </ExampleSection>
        <ExampleSection title={t('states')}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(states) as (keyof typeof states)[]).map(value => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={state === value ? 'secondary' : 'outline'}
                aria-pressed={state === value}
                onClick={() => setState(value)}
              >
                {t('showState', { state: value === 'Offline' ? t('offline') : value })}
              </Button>
            ))}
          </div>
          <div className="flex min-h-80 items-center justify-center rounded-[var(--radius)] border border-border px-6 py-5">
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
          </div>
          <output
            className="block break-words text-sm text-muted-foreground"
            aria-live="polite"
            aria-label={t('stateAction')}
          >
            {localize(stateAction)}
          </output>
        </ExampleSection>
      </div>
      <ExampleDetails title={t('implementation')}>
        <p>{t('help')}</p>
        <p>{t('boundaryHelp')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}

export function FeedbackPage(props: FeedbackPageProps) {
  return (
    <OverlayProvider>
      <FeedbackExamples {...props} />
    </OverlayProvider>
  );
}

function TableReadFeedbackExample() {
  const { t } = useFeedbackText();
  const { t: common } = useTranslation();
  const [status, setStatus] = useState<'pending' | 'error' | 'ready'>('pending');
  return (
    <ExampleSection title={t('tableFeedback')}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setStatus('pending')}>
          {t('showTableLoading')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setStatus('error')}>
          {t('showTableError')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setStatus('ready')}>
          {t('showTableReady')}
        </Button>
      </div>
      <DataTable
        profile="read"
        statePresentation="feedback"
        caption={t('tableFeedback')}
        columns={[{ id: 'name', accessorKey: 'name', header: t('name') }]}
        model={{ kind: 'client', rows: status === 'ready' ? [initialRecord] : [] }}
        getRowId={row => row.id}
        labels={{ ...createDataTableLabels(common), error: t('tableReadErrorHelp') }}
        {...(status === 'ready'
          ? { readState: 'ready' as const, sourceCount: 1, resultCount: 1 }
          : { readState: status, sourceCount: null, resultCount: null })}
        emptyAction={
          status === 'error' ? (
            <Button type="button" onClick={() => setStatus('pending')}>
              {common('common:retry')}
            </Button>
          ) : undefined
        }
      />
    </ExampleSection>
  );
}
