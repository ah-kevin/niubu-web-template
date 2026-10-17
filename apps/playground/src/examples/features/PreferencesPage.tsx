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
    <section aria-label={t('preferences.title')}>
      <h2>{t('preferences.extension')}</h2>
      <p role="status">
        {t('preferences.summaryStatus', {
          layout: value.layout,
          summary: value.showSummary ? t('preferences.visible') : t('preferences.hidden'),
        })}
      </p>
      <button type="button" onClick={() => update({ layout: 'wide', showSummary: false })}>
        {t('preferences.widePreset')}
      </button>
      <label>
        <input
          type="checkbox"
          checked={value.showSummary}
          onChange={event => update({ showSummary: event.target.checked })}
        />
        {t('preferences.showSummary')}
      </label>
      <button type="button" onClick={() => reset()}>
        {t('preferences.reset')}
      </button>
      <div>
        {value.layout === 'wide' ? t('preferences.wide') : t('preferences.balanced')}
        {value.showSummary && <p>{t('preferences.summary')}</p>}
      </div>
      <p>{t('preferences.metadata', { namespace: businessView.namespace, version: businessView.version })}</p>
    </section>
  );
}

export function PreferencesPage(): React.JSX.Element {
  const { t } = useFeaturesText();
  return (
    <div className="space-y-4 p-4">
      <h1>{t('preferences.title')}</h1>
      <p>{t('preferences.help')}</p>
      <SyntheticPreferences>
        <BusinessPreferences />
      </SyntheticPreferences>
    </div>
  );
}
