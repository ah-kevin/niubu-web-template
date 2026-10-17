import { Link, useInRouterContext } from 'react-router-dom';
import { LayoutGrid } from '@niubu/icons';
import { appConfig } from './config';
import './brand.css';

export function PlaygroundBrand({ href, compact = false }: { href?: string; compact?: boolean }) {
  const inRouter = useInRouterContext();
  const content = (
    <>
      <span className="playground-brand-mark" aria-hidden="true">
        <LayoutGrid size={22} strokeWidth={2} />
      </span>
      <span className="playground-brand-name">{appConfig.displayName}</span>
    </>
  );
  const props = {
    className: 'playground-brand',
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
