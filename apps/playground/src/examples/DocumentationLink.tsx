import overlayGuide from './guides/overlays.md?url&no-inline';
import formGuide from './guides/forms.md?url&no-inline';
import tableGuide from './guides/tables.md?url&no-inline';
import { useTranslation } from '@niubu/locales/react';
import { ArrowUpRight } from '@niubu/icons';
/** Bundled local documentation assets also resolve in a production build. */
export function DocumentationLink({ kind }: { kind: 'forms' | 'tables' | 'overlay' }) {
  const { locale } = useTranslation('app');
  return (
    <a
      href={kind === 'tables' ? tableGuide : kind === 'overlay' ? overlayGuide : formGuide}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {locale === 'zh-CN' ? '开发指南（Markdown）' : 'Development guide (Markdown)'}
      <ArrowUpRight aria-hidden="true" size={14} />
    </a>
  );
}
