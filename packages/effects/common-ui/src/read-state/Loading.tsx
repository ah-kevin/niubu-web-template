import { useTranslation } from '@niubu/locales/react';

/** A local loading surface; it does not start, delay or declare completion of a request. */
export function Loading({ label }: { label?: string } = {}) {
  const { t } = useTranslation();
  const text = label ?? t('common:read.loading.title');
  return (
    <div className="pattern-loading" role="status" aria-label={text} aria-live="polite" aria-busy="true">
      <span className="pattern-loading-dots" aria-hidden="true">
        <span className="pattern-loading-dot" />
        <span className="pattern-loading-dot" />
        <span className="pattern-loading-dot" />
        <span className="pattern-loading-dot" />
      </span>
      <span className="pattern-loading-label">{text}</span>
    </div>
  );
}
