import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CorePreferences, DeepPartial } from '@niubu/core-preferences';
import type { PersistenceResult } from '@niubu/preferences';
import { themePresets } from '@niubu/core-design';
import { Check, CircleHelp, Monitor, Moon, Pipette, Sun } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@niubu/shadcn-ui/sheet';
import {
  Select,
  Slider,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
} from '@niubu/shadcn-ui/preference-primitives';
import {
  isValidPreferenceValue,
  preferenceControls,
  preferenceGroups,
  preferencePatch,
  preferenceValue,
  type PreferenceControl,
  type PreferenceGroup,
} from './control-schema';
import { LayoutPreview, PreferenceChoices } from './PreferenceChoices';
export type ExtensionControl = Readonly<{
  namespace: string;
  version: number;
  titleKey: string;
  render: (options: { onResult: (result: PersistenceResult) => void }) => ReactNode;
  reset: () => PersistenceResult;
}>;
export type CopyConfigurationResult = { ok: boolean; text: string };
export type PreferenceDrawerProps = {
  value: CorePreferences;
  onChange: (patch: DeepPartial<CorePreferences>) => PersistenceResult;
  onReset: () => PersistenceResult;
  extensions: readonly ExtensionControl[];
  onCopy?: () => Promise<CopyConfigurationResult>;
  onClose: () => void;
  returnFocus: () => void;
  contentId?: string;
};
type PanelProps = Pick<PreferenceDrawerProps, 'value' | 'onChange'> & { editEpoch?: number };
function Field({ control, value, onChange, editEpoch }: PanelProps & { control: PreferenceControl }) {
  const { t } = useTranslation('shell');
  const id = useId();
  const current = preferenceValue(value, control.key);
  const label = t(`preferences.field.${control.key}`);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [seenEpoch, setSeenEpoch] = useState(editEpoch);
  if (seenEpoch !== editEpoch) {
    setSeenEpoch(editEpoch);
    setDraft(null);
    setInvalid(false);
  }
  const change = (next: unknown) => {
    if (!isValidPreferenceValue(control.key, next)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(preferencePatch(control.key, next));
    setDraft(null);
  };
  const help =
    control.key === 'layout.fixedWidth'
      ? t('preferences.fixedWidthHelp')
      : control.key === 'general.watermark'
        ? t('preferences.watermarkHelp')
        : undefined;
  if (control.kind === 'choices') {
    const modeIcons = { light: Sun, dark: Moon, system: Monitor };
    return (
      <div className="preference-field" data-preference-key={control.key}>
        <PreferenceChoices
          label={label}
          value={typeof current === 'number' ? current : String(current)}
          onChange={change}
          options={(control.options ?? []).map(option => {
            const Icon = modeIcons[option as keyof typeof modeIcons];
            return {
              value: control.key === 'theme.radius' ? Number(option) : option,
              label: t(`preferences.option.${option}`),
              preview:
                control.key === 'layout.mode' ? (
                  <LayoutPreview mode={option} />
                ) : control.key === 'theme.mode' && Icon ? (
                  <Icon size={23} />
                ) : undefined,
            };
          })}
        />
      </div>
    );
  }
  return (
    <div className="preference-field" data-preference-key={control.key}>
      <div className="preference-field-label">
        <label htmlFor={id}>{label}</label>
        {help && (
          <Tooltip content={help}>
            <button type="button" aria-label={help} className="preference-help">
              <CircleHelp size={15} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>
      {control.kind === 'boolean' ? (
        <Switch id={id} aria-label={label} checked={current === true} onCheckedChange={change} />
      ) : control.kind === 'preset' ? (
        <div className="preference-palette" role="group" aria-label={label}>
          {themePresets.map(preset => (
            <button
              type="button"
              key={preset.id}
              aria-label={t(`preferences.option.${preset.id}`)}
              aria-pressed={current === preset.id}
              className={preset.id === 'custom' ? 'preference-swatch preference-swatch-custom' : 'preference-swatch'}
              onClick={() => change(preset.id)}
              title={t(`preferences.option.${preset.id}`)}
            >
              <span className="preference-swatch-preview" aria-hidden="true">
                <span className="preference-swatch-dot" style={{ backgroundColor: preset.swatch || undefined }}>
                  {preset.id === 'custom' && <Pipette size={14} aria-hidden="true" />}
                </span>
                <span className="preference-swatch-check">
                  {current === preset.id && <Check size={14} aria-hidden="true" />}
                </span>
              </span>
              <span className="preference-swatch-label">{t(`preferences.option.${preset.id}`)}</span>
            </button>
          ))}
        </div>
      ) : control.kind === 'select' ? (
        <Select
          label={label}
          value={String(current)}
          onValueChange={change}
          options={(control.options ?? []).map(option => ({ value: option, label: t(`preferences.option.${option}`) }))}
        />
      ) : (
        <div className="preference-inputs">
          <input
            id={id}
            aria-label={label}
            type={control.kind === 'number' ? 'number' : 'text'}
            min={control.bounds?.[0]}
            max={control.bounds?.[1]}
            step={control.kind === 'number' ? 1 : undefined}
            value={draft ?? String(current)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={event => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            onBlur={() => {
              if (draft !== null)
                change(control.kind === 'number' ? (draft.trim() === '' ? NaN : Number(draft)) : draft);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          {control.kind === 'number' && control.bounds && (
            <Slider
              aria-label={`${label} ${t('preferences.slider')}`}
              value={[Number(current)]}
              min={control.bounds[0]}
              max={control.bounds[1]}
              step={1}
              onValueChange={next => change(next[0])}
            />
          )}
        </div>
      )}
      {invalid && (
        <p id={`${id}-error`} role="alert" className="preference-error">
          {t('preferences.invalid')}
        </p>
      )}
    </div>
  );
}
function Panel({ group, ...props }: PanelProps & { group: PreferenceGroup }) {
  const { t } = useTranslation('shell');
  const controls = preferenceControls.filter(control => control.group === group);
  const sections = [...new Set(controls.map(control => control.key.split('.')[0]!))];
  return (
    <>
      {group === 'shortcuts' && <p className="preference-note">{t('preferences.shortcutsHelp')}</p>}
      {sections.map(section => (
        <fieldset key={section} className="preference-section">
          <legend>{t(`preferences.section.${section}`)}</legend>
          {controls
            .filter(control => control.key.split('.')[0] === section)
            .map(control => (
              <Field key={control.key} control={control} {...props} />
            ))}
        </fieldset>
      ))}
    </>
  );
}
export const AppearancePanel = (props: PanelProps) => <Panel group="appearance" {...props} />;
export const LayoutPanel = (props: PanelProps) => <Panel group="layout" {...props} />;
export const ShortcutPanel = (props: PanelProps) => <Panel group="shortcuts" {...props} />;
export const GeneralPanel = (props: PanelProps) => <Panel group="general" {...props} />;
export function ExtensionPanel({
  extensions,
  selected,
  onSelect,
  onResult,
}: {
  extensions: readonly ExtensionControl[];
  selected: ReadonlySet<string>;
  onSelect: (namespace: string, selected: boolean) => void;
  onResult: (namespace: string, result: PersistenceResult) => void;
}) {
  const { t } = useTranslation('shell');
  return (
    <>
      {extensions.map(extension => (
        <fieldset key={`${extension.namespace}@${extension.version}`} className="preference-section">
          <legend>{t(extension.titleKey)}</legend>
          {extension.render({ onResult: result => onResult(extension.namespace, result) })}
          <label className="preference-reset-extension">
            <input
              type="checkbox"
              checked={selected.has(extension.namespace)}
              onChange={event => onSelect(extension.namespace, event.target.checked)}
            />
            {t('preferences.resetExtension')}
          </label>
        </fieldset>
      ))}
      {extensions.length === 0 && <p>{t('preferences.emptyExtensions')}</p>}
      <p className="preference-note">{t('preferences.services')}</p>
    </>
  );
}
/** Controlled display UI. No manager, storage, router, business registry, or session access. */
export function PreferenceDrawer(p: PreferenceDrawerProps) {
  const { t, snapshot: localeStatus } = useTranslation('shell');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editEpoch, setEditEpoch] = useState(0);
  const [results, setResults] = useState<Readonly<Record<string, PersistenceResult>>>({});
  const [copy, setCopy] = useState<CopyConfigurationResult | null>(null);
  const [copyPending, setCopyPending] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const result = (key: string, value: PersistenceResult) => setResults(previous => ({ ...previous, [key]: value }));
  const change = (patch: DeepPartial<CorePreferences>) => {
    const saved = p.onChange(patch);
    result('core', saved);
    return saved;
  };
  const values = Object.values(results);
  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) p.onClose();
      }}
    >
      <SheetContent
        id={p.contentId}
        className="preference-drawer"
        closeLabel={t('common:close')}
        onCloseAutoFocus={event => {
          event.preventDefault();
          p.returnFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{t('preferences.title')}</SheetTitle>
          <SheetDescription>{t('preferences.description')}</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="appearance" className="preference-tabs">
          <TabsList aria-label={t('preferences.title')} className="preference-tab-list">
            {preferenceGroups.map(group => (
              <TabsTrigger key={group} value={group}>
                {t(`preferences.group.${group}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="preference-panel-scroll">
            {preferenceGroups.map(group => (
              <TabsContent key={group} value={group} className="preference-panel">
                {group === 'extensions' ? (
                  <ExtensionPanel
                    extensions={p.extensions}
                    selected={selected}
                    onSelect={(key, checked) =>
                      setSelected(previous => {
                        const next = new Set(previous);
                        if (checked) next.add(key);
                        else next.delete(key);
                        return next;
                      })
                    }
                    onResult={result}
                  />
                ) : (
                  <Panel group={group} value={p.value} onChange={change} editEpoch={editEpoch} />
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
        <div className="preference-drawer-footer">
          {localeStatus.status !== 'ready' && (
            <p role="status">
              {t(localeStatus.status === 'error' ? 'preferences.localeFailed' : 'preferences.localePending', {
                preferred: localeStatus.preferredLocale,
                active: localeStatus.activeLocale,
              })}
            </p>
          )}
          {values.length > 0 && (
            <p role="status">
              {values.some(saved => saved.kind === 'memory') ? t('preferences.notSaved') : t('preferences.saved')}
            </p>
          )}
          {copy && (
            <div>
              <p role="status">{copy.ok ? t('preferences.copySuccess') : t('preferences.copyFailed')}</p>
              {!copy.ok && (
                <textarea
                  readOnly
                  aria-label={t('preferences.copyText')}
                  value={copy.text}
                  onFocus={event => event.currentTarget.select()}
                />
              )}
            </div>
          )}
          <div className="preference-footer-actions">
            <Button
              variant="outline"
              onClick={() => {
                result('core', p.onReset());
                setEditEpoch(epoch => epoch + 1);
                for (const extension of p.extensions)
                  if (selected.has(extension.namespace)) result(extension.namespace, extension.reset());
              }}
            >
              {t('preferences.reset')}
            </Button>
            {p.value.general.copyPreferences && p.onCopy && (
              <Button
                disabled={copyPending}
                onClick={() => {
                  const token = ++generation.current;
                  setCopyPending(true);
                  void p.onCopy!().then(
                    value => {
                      if (token === generation.current) {
                        setCopy(value);
                        setCopyPending(false);
                      }
                    },
                    () => {
                      if (token === generation.current) {
                        setCopy({ ok: false, text: '' });
                        setCopyPending(false);
                      }
                    },
                  );
                }}
              >
                {t('preferences.copy')}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
