import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { useFeaturesText } from './copy';
import { z } from 'zod';
import type { PreferenceExtension } from '@niubu/core-preferences';
import { usePreferenceExtension } from '@niubu/preferences';
import { SyntheticPreferences } from './SyntheticPreferences';

const businessViewSchema = z.object({ layout: z.enum(['balanced', 'wide']), showSummary: z.boolean() });
type BusinessView = z.infer<typeof businessViewSchema>;
const businessView: PreferenceExtension<BusinessView> = {
  namespace: 'playground.business-view',
  version: 1,
  defaults: { layout: 'balanced', showSummary: true },
  validate: value => businessViewSchema.parse(value),
  migrate: value => businessViewSchema.parse(value),
};

function BusinessPreferences() {
  const { t } = useFeaturesText();
  const { value, update, reset } = usePreferenceExtension(businessView, { scopeKey: 'synthetic-business' });
  return (
    <div className="grid min-w-0 items-start gap-[var(--workspace-section-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <ExampleSection title={t('preferences.extension')} description={t('preferences.settingsIntro')}>
        <p role="status" className="rounded-md bg-muted/40 px-3 py-3 text-sm">
          {t('preferences.summaryStatus', {
            layout: value.layout,
            summary: value.showSummary ? t('preferences.visible') : t('preferences.hidden'),
          })}
        </p>
        <div className="grid gap-4">
          <Button
            className="justify-self-start"
            type="button"
            onClick={() => update({ layout: 'wide', showSummary: false })}
          >
            {t('preferences.widePreset')}
          </Button>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.showSummary}
              onCheckedChange={checked => update({ showSummary: checked === true })}
            />
            {t('preferences.showSummary')}
          </label>
          <Button className="justify-self-start" type="button" variant="outline" onClick={() => reset()}>
            {t('preferences.reset')}
          </Button>
        </div>
      </ExampleSection>
      <ExampleSection title={t('preferences.preview')}>
        <div className="min-w-0 rounded-md bg-muted/20 p-4">
          <h3 className="mb-3 text-sm font-medium">
            {value.layout === 'wide' ? t('preferences.wide') : t('preferences.balanced')}
          </h3>
          <ul className={`grid gap-3 ${value.layout === 'wide' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {[1, 2, 3].map(item => (
              <li key={item} className="rounded-lg border border-border bg-card p-4 text-sm">
                {t('preferences.previewItem', { item })}
              </li>
            ))}
          </ul>
          {value.showSummary && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{t('preferences.summary')}</p>}
        </div>
      </ExampleSection>
      <div className="xl:col-span-2">
        <ExampleDetails title={t('implementation')}>
          <p>{t('preferences.help')}</p>
          <p className="break-all text-xs">
            {t('preferences.metadata', { namespace: businessView.namespace, version: businessView.version })}
          </p>
        </ExampleDetails>
      </div>
    </div>
  );
}

export function PreferencesPage(): React.JSX.Element {
  const { t } = useFeaturesText();
  return (
    <ExamplePage title={t('preferences.title')} description={t('preferences.intro')}>
      <SyntheticPreferences>
        <BusinessPreferences />
      </SyntheticPreferences>
    </ExamplePage>
  );
}
