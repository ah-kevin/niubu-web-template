import type { ReactNode } from 'react';
import type { CorePreferences } from '@niubu/core-preferences';
import { useTranslation } from '@niubu/locales/react';
import { ChevronRight } from '@niubu/icons';

/** Structural projection port; route visibility, scope and addresses belong to the caller. */
export type BreadcrumbItem = Readonly<{
  id: string;
  labelKey: string;
  href?: string;
  iconToken?: string;
  current: boolean;
  home?: boolean;
  titleParams?: Readonly<{ titleKey: string }>;
}>;
export type BreadcrumbsProps = Readonly<{
  items: readonly BreadcrumbItem[];
  value: Readonly<CorePreferences['breadcrumb']>;
  renderLink: (item: BreadcrumbItem, children: ReactNode) => ReactNode;
  renderIcon: (token: string | undefined) => ReactNode;
}>;

export function Breadcrumbs({ items, value, renderLink, renderIcon }: BreadcrumbsProps) {
  const { t } = useTranslation();
  const visible = items.filter(item => !item.home || value.showHome);
  if (!value.enabled || (value.hideOnlyOne && visible.length <= 1)) return null;
  return (
    <nav aria-label={t('shell:breadcrumbs')} className="breadcrumbs" data-breadcrumb-style={value.style}>
      {visible.map((item, index) => {
        const text = t(item.labelKey, item.titleParams ? { title: t(item.titleParams.titleKey) } : undefined);
        return (
          <span
            key={item.id}
            className="breadcrumb-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              ...(value.style === 'background'
                ? { background: 'var(--muted)', padding: '3px 6px', borderRadius: 'var(--radius)' }
                : {}),
            }}
          >
            {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
            {value.showIcon && renderIcon(item.iconToken)}
            {item.href && !item.current ? (
              renderLink(item, text)
            ) : (
              <span aria-current={item.current ? 'page' : undefined}>{text}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
