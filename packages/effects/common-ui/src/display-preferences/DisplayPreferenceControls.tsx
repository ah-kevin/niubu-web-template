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
    <div className="display-controls flex flex-col gap-[26px]">
      <fieldset className="border-0 p-0">
        <legend className="mb-[8px] text-[12px] font-semibold">{t('shell:appearance')}</legend>
        <p className="muted mb-[14px] text-[11px] text-muted-foreground">{t('shell:appearanceHelp')}</p>
        <div className="choice-grid grid grid-cols-3 gap-[10px]">
          {(
            [
              { value: 'light', label: t('shell:theme.light'), Icon: Sun },
              { value: 'dark', label: t('shell:theme.dark'), Icon: Moon },
              { value: 'system', label: t('shell:theme.system'), Icon: Monitor },
            ] as const
          ).map(({ value, label, Icon }) => (
            <label
              className="choice-card relative flex min-h-[94px] cursor-pointer flex-col items-center justify-center gap-[9px] rounded-[8px] border border-border text-[11px] has-checked:border-primary has-checked:bg-secondary has-checked:text-primary-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              key={value}
            >
              <input
                type="radio"
                className="absolute top-[8px] right-[8px] size-[12px] accent-primary"
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
      <fieldset className="border-0 p-0">
        <legend className="mb-[8px] text-[12px] font-semibold">{t('shell:density')}</legend>
        <div className="density-options flex gap-[12px]">
          {(
            [
              { value: 'standard', label: t('shell:density.standard') },
              { value: 'compact', label: t('shell:density.compact') },
            ] as const
          ).map(({ value, label }) => (
            <label
              className="density-option flex flex-1 cursor-pointer items-center gap-[9px] rounded-[7px] border border-border px-[15px] py-[12px] text-[12px] has-checked:border-primary has-checked:bg-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              key={value}
            >
              <input
                type="radio"
                className="accent-primary"
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
      <p className="small muted text-xs text-muted-foreground">{t('shell:preferenceHelp')}</p>
      {persistence && (
        <p role="status" className="small muted text-xs text-muted-foreground">
          {persistence.kind === 'persisted' ? t('shell:persisted') : t('shell:memory')}
        </p>
      )}
    </div>
  );
}
