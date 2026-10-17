import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Label } from '@niubu/shadcn-ui/label';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { usePlaygroundApi } from '../app/api-context';
import type { PlaygroundApi } from '../api';
import { AccessControl } from '@niubu/access/react';
import { RequestFailure } from './status';
import { TransferDemo } from '../transfers/TransferDemo';
import { ExamplePage, ExampleSection } from '../examples/ExamplePage';

type EchoResult = Awaited<ReturnType<PlaygroundApi['echo']>>;
export function RequestPage() {
  const api = usePlaygroundApi();
  const { t } = useTranslation('app');
  const id = useId();
  const [value, setValue] = useState('hello');
  const [result, setResult] = useState<EchoResult | null>(null);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setResult(null);
    setPending(true);
    let outcome: EchoResult;
    try {
      outcome = await api.echo({ value }, current.signal);
    } catch {
      outcome = { ok: false, error: { kind: 'transport' } };
    }
    if (current.signal.aborted) return;
    setResult(outcome);
    setPending(false);
  }
  return (
    <ExamplePage title={t('request')} description={t('request.description')}>
      <div className="grid min-w-0 items-start gap-[var(--workspace-section-gap)] xl:grid-cols-2">
        <ExampleSection title={t('request.echo')} description={t('request.echoHelp')}>
          <form className="grid min-w-0 gap-3" onSubmit={event => void submit(event)}>
            <Label htmlFor={id}>{t('value')}</Label>
            <Input id={id} value={value} onChange={event => setValue(event.target.value)} />
            <AccessControl codes={['demo:echo']} strategy="disable">
              {({ disabled }) => (
                <Button className="justify-self-start" type="submit" disabled={pending || disabled}>
                  {t('send')}
                </Button>
              )}
            </AccessControl>
          </form>
          {pending && <p role="status">echo: {t('pending')}</p>}
          {result?.ok && (
            <pre
              className="max-h-72 min-w-0 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words"
              aria-label="echo result"
            >
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
          {result && !result.ok && <RequestFailure name="echo" error={result.error} />}
        </ExampleSection>
        <TransferDemo />
      </div>
    </ExamplePage>
  );
}
