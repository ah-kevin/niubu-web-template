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
    <section aria-label={t('preferences.title')}>
      <h2>{t('preferences.extension')}</h2>
      <p role="status">
        {t('preferences.summaryStatus', {
          layout: value.layout,
          summary: value.showSummary ? t('preferences.visible') : t('preferences.hidden'),
        })}
      </p>
      <Button type="button" onClick={() => update({ layout: 'wide', showSummary: false })}>
        {t('preferences.widePreset')}
      </Button>
      <label>
        <Checkbox checked={value.showSummary} onCheckedChange={checked => update({ showSummary: checked === true })} />
        {t('preferences.showSummary')}
      </label>
      <Button type="button" onClick={() => reset()}>
        {t('preferences.reset')}
      </Button>
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
    <div className="playground-page example-page feature-example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[12px] [&>h1]:text-[24px] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-semibold grid gap-[var(--workspace-section-gap)] [&>section]:min-w-0 [&>section]:rounded-xl [&>section]:border [&>section]:border-border [&>section]:bg-card [&>section]:p-[var(--workspace-card-padding)] [&_section>h2]:mb-3 [&_section>h2]:text-[16px] [&_section>h2]:font-semibold [&_section>[data-slot=button]]:me-2 [&_section>[data-slot=button]]:mt-3 [&_label]:inline-flex [&_label]:flex-wrap [&_label]:items-center [&_label]:gap-2">
      <h1>{t('preferences.title')}</h1>
      <p>{t('preferences.help')}</p>
      <SyntheticPreferences>
        <BusinessPreferences />
      </SyntheticPreferences>
    </div>
  );
}
