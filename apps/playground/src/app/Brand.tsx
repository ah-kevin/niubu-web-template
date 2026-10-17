import { Link, useInRouterContext } from 'react-router-dom';
import { LayoutGrid } from '@niubu/icons';
import { appConfig } from './config';
import './brand.css';

export function PlaygroundBrand({ href, compact = false }: { href?: string; compact?: boolean }) {
  const inRouter = useInRouterContext();
  const content = (
    <>
      <span
        className="playground-brand-mark grid size-[34px] shrink-0 place-items-center rounded-[10px] text-[var(--playground-brand-foreground)] [background:var(--playground-brand-gradient)] [box-shadow:var(--playground-brand-shadow)]"
        aria-hidden="true"
      >
        <LayoutGrid size={22} strokeWidth={2} />
      </span>
      <span className="playground-brand-name truncate text-[16px] leading-snug font-semibold tracking-tight">
        {appConfig.displayName}
      </span>
    </>
  );
  const props = {
    className:
      'playground-brand inline-flex min-w-0 max-w-full items-center gap-[11px] align-middle text-inherit no-underline focus-visible:rounded-[10px] data-[compact=true]:gap-0 data-[compact=true]:[&_.playground-brand-name]:sr-only',
    'data-compact': compact,
    'aria-label': appConfig.displayName,
    title: compact ? appConfig.displayName : undefined,
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
