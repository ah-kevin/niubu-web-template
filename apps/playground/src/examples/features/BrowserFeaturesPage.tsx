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
    <section aria-label={t('browser.fullscreen')}>
      <h2>{t('browser.fullscreen')}</h2>
      <button
        type="button"
        disabled={snapshot.status === 'unsupported' || snapshot.status === 'pending'}
        onClick={() => {
          void toggle();
        }}
      >
        {t('browser.toggleFullscreen')}
      </button>
      <p role="status">
        {t('browser.fullscreenStatus', {
          status: snapshot.status === 'idle' && snapshot.active ? 'active' : snapshot.status,
        })}
      </p>
      {snapshot.error && <p role="alert">{snapshot.error}</p>}
      <p>{t('browser.fullscreenHelp')}</p>
    </section>
  );
}

function ConfigurationAndWatermark() {
  const { t, localize } = useFeaturesText();
  const manager = usePreferenceManager();
  const { core } = usePreferenceSnapshot();
  const text = buildEffectiveConfiguration(core, []);
  const [copyStatus, setCopyStatus] = useState('');
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function copy() {
    const result = await copyEffectiveConfiguration(text, navigator.clipboard);
    if (live.current) setCopyStatus(result.ok ? '配置已复制' : '复制不可用，请手动复制下方配置');
  }
  return (
    <>
      <section aria-label={t('browser.configuration')}>
        <h2>{t('browser.configuration')}</h2>
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
        >
          {t('browser.copy')}
        </button>
        <p role="status">{localize(copyStatus)}</p>
        <textarea aria-label={t('browser.manualCopy')} readOnly value={text} rows={8} />
        <p>{t('browser.copyHelp')}</p>
      </section>
      <section aria-label={t('browser.watermark')}>
        <h2>{t('browser.watermark')}</h2>
        <label>
          <input
            type="checkbox"
            checked={core.general.watermark}
            onChange={event => manager.update({ general: { watermark: event.target.checked } })}
          />
          {t('browser.showWatermark')}
        </label>
        <label>
          {t('browser.watermarkText')}
          <input
            value={core.general.watermarkText}
            onChange={event => manager.update({ general: { watermarkText: event.target.value } })}
          />
        </label>
        <Watermark />
      </section>
    </>
  );
}

export function BrowserFeaturesPage(): React.JSX.Element {
  const { t } = useFeaturesText();
  return (
    <div className="space-y-4 p-4">
      <h1>{t('browser.title')}</h1>
      <p>{t('browser.help')}</p>
      <RootFullscreen />
      <section aria-label={t('browser.icons')}>
        <h2>{t('browser.icons')}</h2>
        {['database', 'settings', 'unknown'].map(name => {
          const Icon = registry.resolve(name);
          return (
            <div key={name}>
              {Icon ? (
                <>
                  <Icon aria-label={t('browser.iconLabel', { name })} />
                  <span>{t('browser.iconRegistered', { name })}</span>
                </>
              ) : (
                <span>{t('browser.iconMissing', { name })}</span>
              )}
            </div>
          );
        })}
      </section>
      <SyntheticPreferences>
        <ConfigurationAndWatermark />
      </SyntheticPreferences>
    </div>
  );
}
