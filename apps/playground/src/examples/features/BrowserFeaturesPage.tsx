import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Input } from '@niubu/shadcn-ui/input';
import { Textarea } from '@niubu/shadcn-ui/textarea';
import { useFeaturesText } from './copy';
import { useEffect, useRef, useState } from 'react';
import { createIconRegistry, Database, Settings2 } from '@niubu/icons';
import { useFullscreen, Watermark } from '@niubu/layouts/widgets';
import {
  buildEffectiveConfiguration,
  copyEffectiveConfiguration,
  usePreferenceManager,
  usePreferenceSnapshot,
} from '@niubu/preferences';
import { SyntheticPreferences } from './SyntheticPreferences';

const registry = createIconRegistry([
  { name: 'database', icon: Database },
  { name: 'settings', icon: Settings2 },
]);

function RootFullscreen() {
  const { t } = useFeaturesText();
  const { snapshot, toggle } = useFullscreen();
  return (
    <ExampleSection title={t('browser.fullscreen')} description={t('browser.fullscreenIntro')}>
      <Button
        className="justify-self-start"
        type="button"
        disabled={snapshot.status === 'unsupported' || snapshot.status === 'pending'}
        onClick={() => {
          void toggle();
        }}
      >
        {t('browser.toggleFullscreen')}
      </Button>
      <p role="status" className="rounded-md bg-muted/40 px-3 py-2 text-sm">
        {t('browser.fullscreenStatus', {
          status: snapshot.status === 'idle' && snapshot.active ? 'active' : snapshot.status,
        })}
      </p>
      {snapshot.error && <p role="alert">{snapshot.error}</p>}
    </ExampleSection>
  );
}

function ConfigurationAndWatermark() {
  const { t, localize } = useFeaturesText();
  const manager = usePreferenceManager();
  const { core } = usePreferenceSnapshot();
  const text = buildEffectiveConfiguration(core, []);
  const [copyStatus, setCopyStatus] = useState('');
  const [showConfiguration, setShowConfiguration] = useState(false);
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function copy() {
    const result = await copyEffectiveConfiguration(text, navigator.clipboard);
    if (live.current) {
      setCopyStatus(result.ok ? '配置已复制' : '复制不可用，请手动复制下方配置');
      if (!result.ok) setShowConfiguration(true);
    }
  }
  return (
    <>
      <ExampleSection title={t('browser.configuration')} description={t('browser.copyHelp')}>
        <Button
          className="justify-self-start"
          type="button"
          onClick={() => {
            void copy();
          }}
        >
          {t('browser.copy')}
        </Button>
        <p role="status" className="text-sm text-muted-foreground empty:hidden">
          {localize(copyStatus)}
        </p>
        <details
          open={showConfiguration}
          onToggle={event => setShowConfiguration(event.currentTarget.open)}
          className="min-w-0 rounded-md border border-border"
        >
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
            {t('browser.manualCopy')}
          </summary>
          <Textarea
            className="rounded-t-none border-x-0 border-b-0 font-mono text-xs leading-relaxed"
            aria-label={t('browser.manualCopy')}
            readOnly
            value={text}
            rows={8}
          />
        </details>
      </ExampleSection>
      <ExampleSection title={t('browser.watermark')} description={t('browser.watermarkIntro')}>
        <label className="my-3 inline-flex items-center gap-2 text-sm">
          <Checkbox
            checked={core.general.watermark}
            onCheckedChange={checked => manager.update({ general: { watermark: checked === true } })}
          />
          {t('browser.showWatermark')}
        </label>

        <label className="grid max-w-xl gap-2 text-sm">
          {t('browser.watermarkText')}
          <Input
            value={core.general.watermarkText}
            onChange={event => manager.update({ general: { watermarkText: event.target.value } })}
          />
        </label>
        <Watermark />
      </ExampleSection>
    </>
  );
}

export function BrowserFeaturesPage(): React.JSX.Element {
  const { t } = useFeaturesText();
  return (
    <ExamplePage title={t('browser.title')} description={t('browser.intro')}>
      <div className="grid min-w-0 items-start gap-[var(--workspace-section-gap)] xl:grid-cols-2">
        <RootFullscreen />
        <ExampleSection title={t('browser.icons')} description={t('browser.iconsIntro')}>
          <div className="grid gap-2 sm:grid-cols-3">
            {['database', 'settings', 'unknown'].map(name => {
              const Icon = registry.resolve(name);
              return (
                <div
                  key={name}
                  className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-4 text-sm"
                >
                  {Icon ? (
                    <>
                      <Icon
                        width={20}
                        height={20}
                        className="shrink-0 text-muted-foreground"
                        aria-label={t('browser.iconLabel', { name })}
                      />
                      <span>{t('browser.iconRegistered', { name })}</span>
                    </>
                  ) : (
                    <span>{t('browser.iconMissing', { name })}</span>
                  )}
                </div>
              );
            })}
          </div>
        </ExampleSection>
        <SyntheticPreferences>
          <ConfigurationAndWatermark />
        </SyntheticPreferences>
      </div>
      <ExampleDetails title={t('implementation')}>
        <p>{t('browser.help')}</p>
        <p>{t('browser.fullscreenHelp')}</p>
        <p>{t('browser.watermarkHelp')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}
