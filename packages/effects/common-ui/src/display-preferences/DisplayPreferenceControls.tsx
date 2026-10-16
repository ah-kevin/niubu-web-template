import { useTranslation } from '@niubu/locales/react';
import { useId } from 'react';
import { Monitor, Moon, Sun } from '@niubu/icons';
import type { PersistenceResult } from '@niubu/preferences';
import type { CorePreferences } from '@niubu/core-preferences';
export type DisplayPreferences = Readonly<{
  theme: CorePreferences['theme']['mode'];
  density: CorePreferences['density'];
}>;
/** Controlled display choices; the caller owns preferences, persistence and lifetime. */
export function DisplayPreferenceControls({
  preferences,
  onChange,
  persistence,
}: {
  preferences: DisplayPreferences;
  persistence?: PersistenceResult | null;
  onChange: (next: DisplayPreferences) => void;
}) {
  const { t } = useTranslation('shell');
  const instance = useId();
  return (
    <div className="display-controls">
      <fieldset>
        <legend>{t('shell:appearance')}</legend>
        <p className="muted">{t('shell:appearanceHelp')}</p>
        <div className="choice-grid">
          {(
            [
              { value: 'light', label: t('shell:theme.light'), Icon: Sun },
              { value: 'dark', label: t('shell:theme.dark'), Icon: Moon },
              { value: 'system', label: t('shell:theme.system'), Icon: Monitor },
            ] as const
          ).map(({ value, label, Icon }) => (
            <label className="choice-card" key={value}>
              <input
                type="radio"
                name={`${instance}-theme`}
                value={value}
                checked={preferences.theme === value}
                onChange={() => onChange({ ...preferences, theme: value })}
              />
              <Icon aria-hidden="true" size={23} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('shell:density')}</legend>
        <div className="density-options">
          {(
            [
              { value: 'standard', label: t('shell:density.standard') },
              { value: 'compact', label: t('shell:density.compact') },
            ] as const
          ).map(({ value, label }) => (
            <label className="density-option" key={value}>
              <input
                type="radio"
                name={`${instance}-density`}
                value={value}
                checked={preferences.density === value}
                onChange={() => onChange({ ...preferences, density: value })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="small muted">{t('shell:preferenceHelp')}</p>
      {persistence && (
        <p role="status" className="small muted">
          {persistence.kind === 'persisted' ? t('shell:persisted') : t('shell:memory')}
        </p>
      )}
    </div>
  );
}
