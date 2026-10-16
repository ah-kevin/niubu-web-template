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
    <section className="playground-page">
      <h1>{t('request')}</h1>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor={id}>{t('value')}</label>
        <input id={id} value={value} onChange={event => setValue(event.target.value)} />
        <AccessControl codes={['demo:echo']} strategy="disable">
          {({ disabled }) => (
            <button type="submit" disabled={pending || disabled}>
              {t('send')}
            </button>
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
