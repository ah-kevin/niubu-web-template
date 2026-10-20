import { Link } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot } from '../auth/context';
import { withScope } from '../auth/scope';
import { ExamplePage, ExampleSection } from '../examples/ExamplePage';
import { Button } from '@niubu/shadcn-ui/button';

export function HomePage() {
  const { t } = useTranslation('app');
  const auth = useAuthSnapshot();
  return (
    <ExamplePage title={t('home')} description={t('home.description')}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {['users', 'roles', 'menus', 'departments'].map(resource => (
          <ExampleSection key={resource} title={t(`system.${resource}`)}>
            <Button asChild variant="outline">
              <Link to={`/system/${resource}${withScope('', auth.scope)}`}>{t('home.open')}</Link>
            </Button>
          </ExampleSection>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
    </ExamplePage>
  );
}
