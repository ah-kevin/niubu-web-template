import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { ArrowRight, Info, LockKeyhole } from '@niubu/icons';
import { Input } from '@niubu/shadcn-ui/input';
import { Label } from '@niubu/shadcn-ui/label';
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
    <section className="auth-card w-full max-w-[370px]">
      <span className="eyebrow">{labels.eyebrow}</span>
      <h1 className="mt-[13px] mb-[12px] text-[28px] [@media(max-width:700px)]:text-[27px]">{labels.heading}</h1>
      <p className="auth-intro muted text-[12px] text-muted-foreground">{labels.description}</p>
      {labels.notice && (
        <div className="notice my-[20px] flex items-start gap-[10px] rounded-[var(--radius-md)] border border-border bg-secondary px-[14px] py-[13px] text-[12px] leading-[1.75] text-foreground [&>svg]:mt-[2px] [&>svg]:text-[var(--primary-text)] [&_strong]:text-[12px] [&_strong]:font-semibold [&_p]:mt-[3px] [&_p]:text-[11px] [&_p]:text-[var(--secondary-muted-foreground)]">
          <Info aria-hidden="true" size={18} />
          <div>
            <strong>{labels.notice.heading}</strong>
            <p>{labels.notice.description}</p>
          </div>
        </div>
      )}
      <form className="mt-[33px]" noValidate onSubmit={submit} aria-busy={pending}>
        <div className="form-field mb-[20px]">
          <Label className="mb-[9px] block text-[12px] font-[550]" htmlFor={emailId}>
            {labels.email}
          </Label>
          <Input
            className="h-[var(--control-height-lg)] rounded-[var(--control-radius-lg)] py-[var(--control-padding-block-lg)] text-[length:var(--control-font-size-lg)] leading-[var(--control-line-height-lg)]"
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
            <p
              className="field-error mt-[7px] text-[length:var(--workspace-caption-font-size)] text-destructive"
              id={`${emailId}-error`}
            >
              {labels.emailError}
            </p>
          )}
        </div>
        {mode === 'login' && (
          <div className="form-field mb-[20px]">
            <div className="field-label-row flex justify-between gap-[10px] [&_a]:text-[10px] [&_a]:text-[var(--primary-text)]">
              <Label className="mb-[9px] block text-[12px] font-[550]" htmlFor={passwordId}>
                {labels.password}
              </Label>
              {links?.recovery && link(links.recovery)}
            </div>
            <Input
              className="h-[var(--control-height-lg)] rounded-[var(--control-radius-lg)] py-[var(--control-padding-block-lg)] text-[length:var(--control-font-size-lg)] leading-[var(--control-line-height-lg)]"
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
              <p
                className="field-error mt-[7px] text-[length:var(--workspace-caption-font-size)] text-destructive"
                id={`${passwordId}-error`}
              >
                {labels.passwordError}
              </p>
            )}
          </div>
        )}
        <Button className="auth-submit mt-[3px] w-full justify-between" size="lg" type="submit" disabled={pending}>
          {labels.submit}
          <ArrowRight aria-hidden="true" size={17} />
        </Button>
        {result && (
          <div
            className="submission-state mt-[17px] flex items-start gap-[10px] rounded-[var(--radius)] bg-secondary p-[14px] text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-[var(--primary-text)] [&_p]:text-[length:var(--workspace-caption-font-size)] [&_p]:text-[var(--secondary-muted-foreground)]"
            role={result.kind === 'error' ? 'alert' : 'status'}
          >
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
        <div className="auth-note mt-[17px] flex items-start gap-[7px] text-[9px] leading-[1.8] text-muted-foreground [&_svg]:mt-[2px]">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>{labels.note}</span>
        </div>
      )}
      {links?.back &&
        link(
          links.back,
          'auth-return inline-block mt-[24px] text-[12px] text-[var(--primary-text)] underline underline-offset-4',
        )}
      {labels.help && (
        <div className="auth-help mt-[34px] border-t border-border pt-[24px] text-[10px] text-muted-foreground">
          {labels.help}
        </div>
      )}
    </section>
  );
}
