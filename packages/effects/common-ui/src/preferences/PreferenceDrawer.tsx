import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { CorePreferences, DeepPartial } from '@niubu/core-preferences';
import type { PersistenceResult } from '@niubu/preferences';
import { themePresets } from '@niubu/core-design';
import { Check, CircleHelp, Monitor, Moon, Pipette, Sun } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Input } from '@niubu/shadcn-ui/input';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Textarea } from '@niubu/shadcn-ui/textarea';
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
      <div
        className="preference-field my-[14px] flex min-w-0 flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px] [&_label]:text-sm data-[preference-key=theme.mode]:[&_.preference-choice-grid]:grid-cols-3 data-[preference-key=layout.mode]:[&_.preference-choice-grid]:grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] data-[preference-key=theme.radius]:[&_.preference-choice-grid]:grid-cols-[repeat(auto-fit,minmax(min(100%,4.25rem),1fr))] data-[preference-key=theme.radius]:[&_.preference-choice-grid]:gap-1 data-[preference-key=theme.radius]:[&_.preference-choice]:px-1 data-[preference-key=theme.radius]:[&_.preference-choice]:py-2.5"
        data-preference-key={control.key}
      >
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
  const updateDraft = (next: string) => {
    setDraft(next);
    setInvalid(false);
  };
  const draftInputProps = {
    id,
    'aria-label': label,
    min: control.bounds?.[0],
    max: control.bounds?.[1],
    step: control.kind === 'number' ? 1 : undefined,
    value: draft ?? String(current),
    className:
      'h-auto w-full rounded-lg border-border bg-background px-[9px] py-[7px] text-sm text-foreground dark:bg-background',
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? `${id}-error` : undefined,
    onBlur: () => {
      if (draft !== null) change(control.kind === 'number' ? (draft.trim() === '' ? NaN : Number(draft)) : draft);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  };
  return (
    <div
      className="preference-field my-[14px] flex min-w-0 flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px] [&_label]:text-sm"
      data-preference-key={control.key}
    >
      <div className="preference-field-label flex flex-[1_1_140px] items-center gap-[5px]">
        <label htmlFor={id}>{label}</label>
        {help && (
          <Tooltip content={help}>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={help}
              className="preference-help size-[17px] shrink-0 rounded-full border-0 bg-transparent p-0 text-muted-foreground [&>svg]:shrink-0"
            >
              <CircleHelp className="size-[15px]" size={15} aria-hidden="true" />
            </Button>
          </Tooltip>
        )}
      </div>
      {control.kind === 'boolean' ? (
        <Switch id={id} aria-label={label} checked={current === true} onCheckedChange={change} />
      ) : control.kind === 'preset' ? (
        <div
          className="preference-palette grid w-full grid-cols-3 gap-x-4 gap-y-2.5 py-[4px]"
          role="group"
          aria-label={label}
        >
          {themePresets.map(preset => (
            <Button
              variant="ghost"
              type="button"
              key={preset.id}
              aria-label={t(`preferences.option.${preset.id}`)}
              aria-pressed={current === preset.id}
              className={`preference-swatch group flex h-auto whitespace-normal min-w-0 flex-col items-center gap-1 rounded-lg border-0 bg-transparent p-0 text-muted-foreground outline-none hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[3px] aria-pressed:text-primary-text ${preset.id === 'custom' ? 'preference-swatch-custom [&_.preference-swatch-dot]:border [&_.preference-swatch-dot]:border-dashed [&_.preference-swatch-dot]:border-input' : ''}`}
              onClick={() => change(preset.id)}
              title={t(`preferences.option.${preset.id}`)}
            >
              <span
                className="preference-swatch-preview relative flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-card p-2 group-hover:bg-accent group-aria-pressed:border-primary group-aria-pressed:shadow-[inset_0_0_0_1px_var(--primary)]"
                aria-hidden="true"
              >
                <span
                  className="preference-swatch-dot flex size-5 items-center justify-center rounded-[calc(var(--radius)*.75)] text-foreground leading-none [&>svg]:shrink-0"
                  style={{ backgroundColor: preset.swatch || undefined }}
                >
                  {preset.id === 'custom' && <Pipette className="size-[14px]" size={14} aria-hidden="true" />}
                </span>
                <span className="preference-swatch-check absolute top-1 right-1.5 inline-flex items-center text-primary-text leading-none [&>svg]:shrink-0">
                  {current === preset.id && <Check className="size-[14px]" size={14} aria-hidden="true" />}
                </span>
              </span>
              <span className="preference-swatch-label max-w-full text-center text-xs leading-normal wrap-anywhere">
                {t(`preferences.option.${preset.id}`)}
              </span>
            </Button>
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
        <div className="preference-inputs w-[160px] max-w-full">
          {control.kind === 'number' ? (
            <NumberInput {...draftInputProps} valueMode="string" onValueChange={updateDraft} />
          ) : (
            <Input {...draftInputProps} onChange={event => updateDraft(event.currentTarget.value)} />
          )}
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
        <p id={`${id}-error`} role="alert" className="preference-error w-full text-[.8rem] text-destructive">
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
      {group === 'shortcuts' && (
        <p className="preference-note text-[.8rem] leading-[1.6] text-muted-foreground">
          {t('preferences.shortcutsHelp')}
        </p>
      )}
      {sections.map(section => (
        <fieldset
          key={section}
          className="preference-section m-0 mb-[12px] min-w-0 border-0 border-b border-border pt-[10px] pb-[16px] [&>legend]:pt-[8px] [&>legend]:font-semibold"
        >
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
        <fieldset
          key={`${extension.namespace}@${extension.version}`}
          className="preference-section m-0 mb-[12px] min-w-0 border-0 border-b border-border pt-[10px] pb-[16px] [&>legend]:pt-[8px] [&>legend]:font-semibold"
        >
          <legend>{t(extension.titleKey)}</legend>
          {extension.render({ onResult: result => onResult(extension.namespace, result) })}
          <label className="preference-reset-extension mt-[12px] flex gap-[7px] text-[.8rem]">
            <Checkbox
              checked={selected.has(extension.namespace)}
              onCheckedChange={checked => onSelect(extension.namespace, checked === true)}
            />
            {t('preferences.resetExtension')}
          </label>
        </fieldset>
      ))}
      {extensions.length === 0 && <p>{t('preferences.emptyExtensions')}</p>}
      <p className="preference-note text-[.8rem] leading-[1.6] text-muted-foreground">{t('preferences.services')}</p>
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
        className="preference-drawer w-[min(100vw,384px)] max-w-[min(100vw,384px)] gap-0 p-0 sm:max-w-[min(100vw,384px)]"
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
        <Tabs defaultValue="appearance" className="preference-tabs flex min-h-0 flex-1 flex-col">
          <TabsList
            aria-label={t('preferences.title')}
            className="preference-tab-list w-auto min-w-0 max-w-full mx-[12px] mt-2 mb-1 grid shrink-0 grid-cols-[repeat(5,minmax(max-content,1fr))] overflow-x-auto [scrollbar-width:thin]"
          >
            {preferenceGroups.map(group => (
              <TabsTrigger key={group} value={group} className="min-w-max">
                {t(`preferences.group.${group}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="preference-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {preferenceGroups.map(group => (
              <TabsContent key={group} value={group} className="preference-panel p-[12px] -outline-offset-3">
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
        <div className="preference-drawer-footer shrink-0 border-t border-border p-[12px] text-[.8rem]">
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
                <Textarea
                  className="max-h-[140px] w-full bg-muted text-foreground dark:bg-muted"
                  readOnly
                  aria-label={t('preferences.copyText')}
                  value={copy.text}
                  onFocus={event => event.currentTarget.select()}
                />
              )}
            </div>
          )}
          <div className="preference-footer-actions flex flex-wrap gap-[8px] pt-[8px]">
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
