import { useTranslation } from '@niubu/locales/react';
import { CircleAlert, Database, SearchX } from '@niubu/icons';
import type { ReactNode } from 'react';
import { useReturnPathResolver } from '../return-path';
import { Button } from '@niubu/shadcn-ui/button';

const titles = {
  loading: 'common:read.loading.title',
  empty: 'common:read.empty.title',
  'source-empty': 'common:read.source-empty.title',
  'not-found': 'common:read.not-found.title',
  forbidden: 'common:read.forbidden.title',
  'not-enabled': 'common:read.not-enabled.title',
  error: 'common:read.error.title',
};
const explanations = {
  loading: 'common:read.loading.description',
  empty: 'common:read.empty.description',
  'source-empty': 'common:read.source-empty.description',
  'not-found': 'common:read.not-found.description',
  forbidden: 'common:read.forbidden.description',
  'not-enabled': 'common:read.not-enabled.description',
  error: 'common:read.error.description',
};

export function ReadState({
  status,
  message,
  onRetry,
  onReset,
  onNavigate,
  fallback = '',
  children,
  actions,
}: {
  status: keyof typeof titles;
  message?: string;
  onRetry?: () => void;
  onReset?: () => void;
  onNavigate?: (href: string) => void;
  fallback?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const safeReturnTo = useReturnPathResolver();
  const Icon =
    status === 'empty' ? SearchX : status === 'loading' || status === 'source-empty' ? Database : CircleAlert;
  const href = safeReturnTo(fallback, '');
  return (
    <section
      className="pattern-read-state flex min-w-0 flex-col items-center gap-3 px-6 py-12 text-center [overflow-wrap:anywhere]"
      role={status === 'error' ? 'alert' : 'status'}
      aria-busy={status === 'loading'}
    >
      <span className="pattern-state-symbol inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-primary-text">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold">{t(titles[status])}</h2>
      <p className="max-w-[440px] text-[length:var(--workspace-body-font-size)] leading-relaxed text-muted-foreground">
        {message ?? t(explanations[status])}
      </p>
      {children}
      {actions !== null && (
        <div className="pattern-state-actions mt-1 flex flex-wrap justify-center gap-2">
          {actions === undefined ? (
            <>
              {status === 'error' && onRetry && (
                <Button type="button" onClick={onRetry}>
                  {t('common:retry')}
                </Button>
              )}
              {status === 'empty' && onReset && (
                <Button type="button" variant="outline" onClick={onReset}>
                  {t('common:clearFilters')}
                </Button>
              )}
              {status !== 'loading' &&
                (onNavigate ? (
                  <Button type="button" variant="outline" onClick={() => onNavigate(href)}>
                    {t('common:backToWorkspace')}
                  </Button>
                ) : (
                  <Button variant="outline" asChild>
                    <a href={href}>{t('common:backToWorkspace')}</a>
                  </Button>
                ))}
            </>
          ) : (
            actions
          )}
        </div>
      )}
    </section>
  );
}
