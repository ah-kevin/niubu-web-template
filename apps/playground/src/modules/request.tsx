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
    <section className="playground-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[1rem] [&>h1]:text-[1.5rem] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
      <h1>{t('request')}</h1>
      <form className="grid max-w-lg gap-3" onSubmit={event => void submit(event)}>
        <Label htmlFor={id}>{t('value')}</Label>
        <Input id={id} value={value} onChange={event => setValue(event.target.value)} />
        <AccessControl codes={['demo:echo']} strategy="disable">
          {({ disabled }) => (
            <Button type="submit" disabled={pending || disabled}>
              {t('send')}
            </Button>
          )}
        </AccessControl>
      </form>
      {pending && <p role="status">echo: {t('pending')}</p>}
      {result?.ok && <pre aria-label="echo result">{JSON.stringify(result.data, null, 2)}</pre>}
      {result && !result.ok && <RequestFailure name="echo" error={result.error} />}
      <TransferDemo />
    </section>
  );
}
