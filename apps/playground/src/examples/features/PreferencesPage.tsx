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
      <div className="my-4 flex flex-wrap items-center gap-4">
        <Button type="button" onClick={() => update({ layout: 'wide', showSummary: false })}>
          {t('preferences.widePreset')}
        </Button>
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.showSummary}
            onCheckedChange={checked => update({ showSummary: checked === true })}
          />
          {t('preferences.showSummary')}
        </label>
        <Button type="button" variant="outline" onClick={() => reset()}>
          {t('preferences.reset')}
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-4" aria-label={t('preferences.preview')}>
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
      <p className="mt-4 break-all text-xs text-muted-foreground">
        {t('preferences.metadata', { namespace: businessView.namespace, version: businessView.version })}
      </p>
    </section>
  );
}

export function PreferencesPage(): React.JSX.Element {
  const { t } = useFeaturesText();
  return (
    <div className="playground-page example-page feature-example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[var(--workspace-heading-gap)] [&>h1]:text-[length:var(--workspace-title-font-size)] [&>h1]:font-[650] [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold grid gap-[var(--workspace-section-gap)] [&>section]:min-w-0 [&>section]:rounded-[var(--radius)] [&>section]:border [&>section]:border-border [&>section]:bg-card [&>section]:p-[var(--workspace-card-padding)] [&_section>h2]:mb-3 [&_section>h2]:text-base [&_section>h2]:font-semibold [&_section>[data-slot=button]]:me-2 [&_section>[data-slot=button]]:mt-3">
      <h1>{t('preferences.title')}</h1>
      <p>{t('preferences.help')}</p>
      <SyntheticPreferences>
        <BusinessPreferences />
      </SyntheticPreferences>
    </div>
  );
}
