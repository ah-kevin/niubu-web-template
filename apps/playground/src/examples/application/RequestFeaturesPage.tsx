import { useApplicationText } from './copy';
import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
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
    <ExamplePage title={text('requestTitle')} description={text('requestIntro')}>
      <div className="grid min-w-0 items-start gap-[var(--workspace-section-gap)] xl:grid-cols-2">
        <ExampleSection title={text('queryTitle')}>
          <p className="text-sm text-muted-foreground">{text('queryIntro')}</p>
          <Button
            className="justify-self-start"
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
        </ExampleSection>
        <ExampleSection title={text('download')}>
          <Button
            className="justify-self-start"
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
          {!file && (
            <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              {text('downloadEmpty')}
            </p>
          )}
          {file && (
            <>
              <p className="break-words rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm">
                {file.filename} · {file.contentType} · {file.blob.size} bytes
              </p>
              <Button
                variant="outline"
                className="justify-self-start"
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
        </ExampleSection>
        <ExampleSection title={text('expiryTitle')} className="xl:col-span-2">
          <p className="rounded-md bg-muted/40 px-3 py-3 text-sm">
            {state.loginExpired ? text('expired') : `${text('session')} ${state.status}`}
          </p>
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
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm empty:hidden" role="status">
            {result === 'synthetic-init-failed' ? text('initFailed') : result}
          </p>
        </ExampleSection>
      </div>
      <ExampleDetails title={text('implementation')}>
        <p>{text('requestHelp')}</p>
        <p>{text('queryHelp')}</p>
        <pre>
          <code>{safeQuery.toString()}</code>
        </pre>
      </ExampleDetails>
    </ExamplePage>
  );
}
