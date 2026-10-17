import overlayGuide from './guides/overlays.md?url&no-inline';
import formGuide from './guides/forms.md?url&no-inline';
import tableGuide from './guides/tables.md?url&no-inline';
import { useTranslation } from '@niubu/locales/react';
/** Bundled local documentation assets also resolve in a production build. */
export function DocumentationLink({ kind }: { kind: 'forms' | 'tables' | 'overlay' }) {
  const { locale } = useTranslation('app');
  return (
    <a
      href={kind === 'tables' ? tableGuide : kind === 'overlay' ? overlayGuide : formGuide}
      target="_blank"
      rel="noopener noreferrer"
    >
      {locale === 'zh-CN' ? '开发指南（Markdown）' : 'Development guide (Markdown)'}
    </a>
  );
}
