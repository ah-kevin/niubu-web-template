import { useTranslation } from '@niubu/locales/react';
import { formatInstant } from '@niubu/locales';
import { useId, type ReactNode } from 'react';
import { ArrowLeft } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { useReturnPathResolver } from '../return-path';
import { PageHeader } from '../page-header';

export type DetailFrameProps = {
  title: string;
  description?: string;
  returnTo: string | null;
  fallback: string;
  onNavigate: (href: string) => void;
  tabs?: readonly { id: string; label: string }[];
  tab?: string;
  onTabChange?: (tab: string) => void;
  source: string;
  asOf: string;
  timeZone?: string;
  actions?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
};

export function DetailFrame({
  title,
  description,
  returnTo,
  fallback,
  onNavigate,
  tabs = [],
  tab,
  onTabChange,
  source,
  asOf,
  timeZone = 'UTC',
  actions,
  summary,
  children,
}: DetailFrameProps) {
  const { t, locale } = useTranslation();
  const safeReturnTo = useReturnPathResolver();
  const id = useId();
  const activeTab = tabs.some(item => item.id === tab) ? tab : tabs[0]?.id;
  return (
    <section className="pattern-detail-frame">
      <Button
        type="button"
        variant="ghost"
        className="pattern-back"
        onClick={() => onNavigate(safeReturnTo(returnTo, fallback))}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('common:backToList')}
      </Button>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        meta={
          <p className="pattern-provenance">
            {t('common:source')}：{source} · {t('common:asOf')}{' '}
            <time dateTime={asOf} title={asOf}>
              {formatInstant(asOf, { locale, timeZone })}
            </time>
          </p>
        }
      />
      {summary}
      {tabs.length > 0 && (
        <div className="pattern-detail-tabs" role="tablist" aria-label={t('common:detailContent')}>
          {tabs.map((item, index) => (
            <button
              type="button"
              role="tab"
              id={`${id}-${item.id}`}
              aria-selected={item.id === activeTab}
              aria-controls={`${id}-panel`}
              tabIndex={item.id === activeTab ? 0 : -1}
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              onKeyDown={event => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  onTabChange?.(tabs[next].id);
                  document.getElementById(`${id}-${tabs[next].id}`)?.focus();
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="pattern-detail-content"
        id={`${id}-panel`}
        role={tabs.length ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length ? `${id}-${activeTab}` : undefined}
      >
        {children}
      </div>
    </section>
  );
}
