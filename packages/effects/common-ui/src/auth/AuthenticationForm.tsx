import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { ArrowRight, Info, LockKeyhole } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
export type AuthenticationMode = 'login' | 'recover' | 'invite';
export interface AuthenticationValues {
  email: string;
  password?: string;
}
export interface AuthenticationResult {
  kind: 'not-submitted' | 'error' | 'success';
  message?: string;
}
export interface AuthenticationLink {
  href: string;
  label: ReactNode;
}
export interface AuthenticationLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}
export interface AuthenticationFormProps {
  mode: AuthenticationMode;
  fieldIds?: Readonly<{ email?: string; password?: string }>;
  labels: {
    eyebrow: ReactNode;
    heading: ReactNode;
    description: ReactNode;
    submit: ReactNode;
    email: ReactNode;
    password: ReactNode;
    passwordPlaceholder: string;
    emailPlaceholder?: string;
    emailError: ReactNode;
    passwordError: ReactNode;
    submitError: string;
    resultTitles: Record<AuthenticationResult['kind'], ReactNode>;
    resultDescriptions?: Partial<Record<AuthenticationResult['kind'], ReactNode>>;
    notice?: { heading: ReactNode; description: ReactNode };
    note?: ReactNode;
    help?: ReactNode;
  };
  links?: { recovery?: AuthenticationLink; back?: AuthenticationLink };
  renderLink?: (props: AuthenticationLinkProps) => ReactElement;
  onSubmit: (values: AuthenticationValues, signal?: AbortSignal) => Promise<AuthenticationResult>;
}
export function AuthenticationForm(props: AuthenticationFormProps) {
  return <AuthenticationFields key={props.mode} {...props} />;
}
function AuthenticationFields({ mode, fieldIds, labels, links, renderLink, onSubmit }: AuthenticationFormProps) {
  const id = useId();
  const emailId = fieldIds?.email ?? `${id}-email`;
  const passwordId = fieldIds?.password ?? `${id}-password`;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const activeSubmit = useRef<AbortController | null>(null);
  const [errors, setErrors] = useState({ email: false, password: false });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AuthenticationResult | null>(null);
  useEffect(
    () => () => {
      generation.current += 1;
      activeSubmit.current?.abort();
      activeSubmit.current = null;
    },
    [],
  );
  function changed() {
    generation.current += 1;
    activeSubmit.current?.abort();
    activeSubmit.current = null;
    setPending(false);
    setResult(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailRef.current?.value.trim() ?? '';
    const password = passwordRef.current?.value ?? '';
    const next = {
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      password: mode === 'login' && !password,
    };
    setErrors(next);
    setResult(null);
    if (next.email) {
      emailRef.current?.focus();
      return;
    }
    if (next.password) {
      passwordRef.current?.focus();
      return;
    }
    const current = ++generation.current;
    activeSubmit.current?.abort();
    const controller = new AbortController();
    activeSubmit.current = controller;
    setPending(true);
    try {
      const response = await onSubmit(mode === 'login' ? { email, password } : { email }, controller.signal);
      if (generation.current === current) setResult(response);
    } catch {
      if (generation.current === current) setResult({ kind: 'error', message: labels.submitError });
    } finally {
      if (generation.current === current) {
        activeSubmit.current = null;
        setPending(false);
      }
    }
  }
  function link(value: AuthenticationLink, className?: string) {
    const props = { href: value.href, children: value.label, className };
    return renderLink ? renderLink(props) : <a {...props} />;
  }
  return (
    <section className="auth-card">
      <span className="eyebrow">{labels.eyebrow}</span>
      <h1>{labels.heading}</h1>
      <p className="auth-intro muted">{labels.description}</p>
      {labels.notice && (
        <div className="notice">
          <Info aria-hidden="true" size={18} />
          <div>
            <strong>{labels.notice.heading}</strong>
            <p>{labels.notice.description}</p>
          </div>
        </div>
      )}
      <form noValidate onSubmit={submit} aria-busy={pending}>
        <div className="form-field">
          <label htmlFor={emailId}>{labels.email}</label>
          <input
            id={emailId}
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="email"
            placeholder={labels.emailPlaceholder}
            required
            aria-invalid={errors.email}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            onChange={changed}
          />
          {errors.email && (
            <p className="field-error" id={`${emailId}-error`}>
              {labels.emailError}
            </p>
          )}
        </div>
        {mode === 'login' && (
          <div className="form-field">
            <div className="field-label-row">
              <label htmlFor={passwordId}>{labels.password}</label>
              {links?.recovery && link(links.recovery)}
            </div>
            <input
              id={passwordId}
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={labels.passwordPlaceholder}
              required
              aria-invalid={errors.password}
              aria-describedby={errors.password ? `${passwordId}-error` : undefined}
              onChange={changed}
            />
            {errors.password && (
              <p className="field-error" id={`${passwordId}-error`}>
                {labels.passwordError}
              </p>
            )}
          </div>
        )}
        <Button className="auth-submit" size="lg" type="submit" disabled={pending}>
          {labels.submit}
          <ArrowRight aria-hidden="true" size={17} />
        </Button>
        {result && (
          <div className="submission-state" role={result.kind === 'error' ? 'alert' : 'status'}>
            <Info size={18} aria-hidden="true" />
            <div>
              <strong>{labels.resultTitles[result.kind]}</strong>
              {(result.message ?? labels.resultDescriptions?.[result.kind]) && (
                <p>{result.message ?? labels.resultDescriptions?.[result.kind]}</p>
              )}
            </div>
          </div>
        )}
      </form>
      {labels.note && (
        <div className="auth-note">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>{labels.note}</span>
        </div>
      )}
      {links?.back && link(links.back, 'auth-return')}
      {labels.help && <div className="auth-help">{labels.help}</div>}
    </section>
  );
}
