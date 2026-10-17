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
    <section className="pattern-detail-frame min-w-0 max-w-full">
      <Button
        type="button"
        variant="ghost"
        className="pattern-back mb-[20px] pl-0 text-[length:var(--workspace-caption-font-size)]"
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
          <p className="pattern-provenance text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-muted-foreground">
            {t('common:source')}：{source} · {t('common:asOf')}{' '}
            <time dateTime={asOf} title={asOf}>
              {formatInstant(asOf, { locale, timeZone })}
            </time>
          </p>
        }
      />
      {summary}
      {tabs.length > 0 && (
        <div
          className="pattern-detail-tabs mb-[24px] flex max-w-full gap-[var(--workspace-section-gap)] overflow-x-auto border-b border-border"
          role="tablist"
          aria-label={t('common:detailContent')}
        >
          {tabs.map((item, index) => (
            <Button
              variant="ghost"
              className="h-auto min-h-[44px] rounded-none border-b-2 border-transparent px-0 py-[13px] text-[length:var(--workspace-caption-font-size)] whitespace-nowrap text-muted-foreground aria-selected:border-primary aria-selected:font-semibold aria-selected:text-[var(--primary-text)]"
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
            </Button>
          ))}
        </div>
      )}
      <div
        className="pattern-detail-content min-w-0 [overflow-wrap:anywhere]"
        id={`${id}-panel`}
        role={tabs.length ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length ? `${id}-${activeTab}` : undefined}
      >
        {children}
      </div>
    </section>
  );
}
