import { useTranslation } from '@niubu/locales/react';
import { Link, useInRouterContext } from 'react-router-dom';
import { LayoutGrid } from '@niubu/icons';
import './brand.css';

export function StarterBrand({ href, compact = false }: { href?: string; compact?: boolean }) {
  const { t } = useTranslation('app');
  const inRouter = useInRouterContext();
  const content = (
    <>
      <span
        className="starter-brand-mark grid size-[34px] shrink-0 place-items-center rounded-[10px] text-[var(--starter-brand-foreground)] [background:var(--starter-brand-gradient)] [box-shadow:var(--starter-brand-shadow)]"
        aria-hidden="true"
      >
        <LayoutGrid size={22} strokeWidth={2} />
      </span>
      <span className="starter-brand-name truncate text-[16px] leading-snug font-semibold tracking-tight">
        {t('productName')}
      </span>
    </>
  );
  const props = {
    className:
      'starter-brand inline-flex min-w-0 max-w-full items-center gap-[11px] align-middle text-inherit no-underline focus-visible:rounded-[10px] data-[compact=true]:gap-0 data-[compact=true]:[&_.starter-brand-name]:sr-only',
    'data-compact': compact,
    'aria-label': t('productName'),
    title: compact ? t('productName') : undefined,
  };
  return href && inRouter ? (
    <Link {...props} to={href}>
      {content}
    </Link>
  ) : href ? (
    <a {...props} href={href}>
      {content}
    </a>
  ) : (
    <span {...props}>{content}</span>
  );
}
