import { useApplicationText } from './copy';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { downloadBlob, isAccessExpired, type DownloadFile } from '@niubu/request';
import { parseQuery, mergeQuery } from '@niubu/utils';
import { Button } from '@niubu/shadcn-ui/button';
import { saveDownload } from '../../transfers/save-download';
import { createRequestExample } from './request-fixture';
export function RequestFeaturesPage() {
  const text = useApplicationText();
  const [owner] = useState(createRequestExample);
  const state = useSyncExternalStore(owner.auth.subscribe, owner.auth.getSnapshot, owner.auth.getSnapshot);
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<DownloadFile | null>(null);
  const [result, setResult] = useState('');
  const [downloadError, setDownloadError] = useState<'downloadFailed' | 'cannotSave' | null>(null);
  const [releases] = useState(() => new Set<() => void>());
  const lifetime = useRef(0);
  useEffect(() => {
    const generation = ++lifetime.current;
    const isCurrent = () => lifetime.current === generation;
    let alive = true;
    void owner.ready().catch(() => {
      if (alive) setResult('synthetic-init-failed');
    });
    return () => {
      alive = false;
      queueMicrotask(() => {
        if (!isCurrent()) return;
        releases.forEach(fn => fn());
        releases.clear();
        owner.dispose();
      });
    };
  }, [owner, releases]);
  const safeQuery = mergeQuery(
    new URLSearchParams('scopeKind=workspace&scopeId=north&view=list'),
    parseQuery(new URLSearchParams('q=sample&page=2&sort=name&filter.status=ready'), ['name'], { status: ['ready'] }),
  );
  return (
    <section className="playground-page example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[var(--workspace-heading-gap)] [&>h1]:text-[length:var(--workspace-title-font-size)] [&>h1]:font-[650] [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold">
      <h1>{text('requestTitle')}</h1>
      <p>{text('requestHelp')}</p>
      <section
        aria-label={text('queryTitle')}
        className="example-card my-4 min-w-0 rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs"
      >
        <h2>{text('queryTitle')}</h2>
        <pre className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
          <code className="break-all">{safeQuery.toString()}</code>
        </pre>
        <p>{text('queryHelp')}</p>
        <Button
          disabled={state.status !== 'ready' || state.loginExpired}
          onClick={() =>
            void owner.client
              .execute({
                path: '/echo',
                method: 'GET',
                activity: 'background',
                query: new URLSearchParams([
                  ['query', 'one'],
                  ['query', 'two'],
                ]),
                decode: String,
              })
              .then(r => setQuery(r.ok ? r.data : r.error.kind))
          }
        >
          {text('repeat')}
        </Button>
        <output aria-live="polite" className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
          {query || text('waitingRequest')}
        </output>
      </section>
      <section
        aria-label={text('download')}
        className="example-card my-4 min-w-0 rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs"
      >
        <h2>{text('download')}</h2>
        <Button
          disabled={state.status !== 'ready' || state.loginExpired}
          onClick={() =>
            void downloadBlob(owner.client, { path: '/file', method: 'GET', activity: 'background' }).then(r => {
              if (r.ok) {
                setFile(r.data);
                setDownloadError(null);
              } else setDownloadError('downloadFailed');
            })
          }
        >
          {text('metadata')}
        </Button>
        {downloadError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {text(downloadError)}
          </p>
        )}
        {file && (
          <>
            <p>
              {file.filename} · {file.contentType} · {file.blob.size} bytes
            </p>
            <Button
              onClick={() => {
                try {
                  setDownloadError(null);
                  const release = saveDownload(file, {
                    createObjectURL: b => URL.createObjectURL(b),
                    revokeObjectURL: u => URL.revokeObjectURL(u),
                    activate: (url, filename) => {
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      a.click();
                    },
                    scheduleRelease: done => {
                      const timer = setTimeout(() => {
                        done();
                        releases.delete(release);
                      }, 1000);
                      return () => clearTimeout(timer);
                    },
                  });
                  releases.add(release);
                } catch {
                  setDownloadError('cannotSave');
                }
              }}
            >
              {text('save')}
            </Button>
          </>
        )}
      </section>
      <section
        aria-label={text('expiryTitle')}
        className="example-card my-4 min-w-0 rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs"
      >
        <h2>{text('expiryTitle')}</h2>
        <p>{state.loginExpired ? text('expired') : `${text('session')} ${state.status}`}</p>
        <div className="my-3 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() =>
              setResult(
                isAccessExpired({ kind: 'http', status: 401, code: 'UNAUTHORIZED' })
                  ? text('expiryYes')
                  : text('expiryNo'),
              )
            }
          >
            {text('normal401')}
          </Button>
          <Button
            disabled={state.status !== 'ready' || state.loginExpired}
            onClick={() =>
              void owner.client
                .execute({ path: '/expired', method: 'GET', activity: 'background', decode: data => data })
                .then(() => {})
            }
          >
            {text('simulate')}
          </Button>
          <Button
            disabled={!state.loginExpired}
            onClick={() => void owner.auth.login({}, '/home').catch(() => setResult(text('recoveryFailed')))}
          >
            {text('recover')}
          </Button>
        </div>
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm" role="status">
          {result === 'synthetic-init-failed' ? text('initFailed') : result}
        </p>
      </section>
    </section>
  );
}
