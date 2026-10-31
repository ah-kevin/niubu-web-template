import { ControlGallery } from './ControlGallery';
import { useComponentsText } from './copy';
import { useId, useState } from 'react';
import { CircleHelp, ClipboardList, Menu, Settings2 } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@niubu/shadcn-ui/radio-group';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  Tooltip,
} from '@niubu/shadcn-ui/preference-primitives';
import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';

export function ComponentsPage() {
  const { t, localize } = useComponentsText();
  const id = useId();
  const [density, setDensity] = useState('compact');
  const [channels, setChannels] = useState<string[]>([]);
  const [applied, setApplied] = useState<{ density: string; channels: string[] } | null>(null);
  const [allowArchive, setAllowArchive] = useState(false);
  const [menuResult, setMenuResult] = useState('No menu action');
  const appliedDensity = applied && t(applied.density === 'compact' ? 'compact' : 'comfortable');
  const appliedChannels = applied?.channels.length
    ? applied.channels.map(channel => t(channel === 'email' ? 'email' : 'sms')).join(', ')
    : t('noChannels');
  return (
    <ExamplePage title={t('title')} description={t('pageDescription')}>
      <ControlGallery />
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <ExampleSection
          title={t('choices')}
          description={t('choicesHelp')}
          className="lg:row-span-2"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDensity('compact');
                  setChannels([]);
                  setApplied(null);
                }}
              >
                {t('reset')}
              </Button>
              <Button type="button" onClick={() => setApplied({ density, channels })}>
                {t('apply')}
              </Button>
            </>
          }
        >
          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-4">
            <Settings2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">{t('selectionHelp')}</p>
          </div>
          <fieldset className="grid gap-3 border-b border-border pb-5">
            <legend className="mb-3 text-sm font-medium">{t('density')}</legend>
            <RadioGroup
              className="grid gap-3 sm:grid-cols-2"
              aria-label={t('density')}
              value={density}
              onValueChange={setDensity}
            >
              {(['compact', 'comfortable'] as const).map(value => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-border px-4 py-3 text-sm has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5"
                  key={value}
                  htmlFor={`${id}-${value}`}
                >
                  <RadioGroupItem id={`${id}-${value}`} value={value} />
                  {value === 'compact' ? t('compact') : t('comfortable')}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium">{t('channels')}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {(['email', 'sms'] as const).map(value => (
                <label
                  className="inline-flex cursor-pointer items-center gap-2 text-sm"
                  key={value}
                  htmlFor={`${id}-${value}`}
                >
                  <Checkbox
                    id={`${id}-${value}`}
                    checked={channels.includes(value)}
                    onCheckedChange={checked => {
                      setChannels(current =>
                        checked === true ? [...current, value] : current.filter(item => item !== value),
                      );
                    }}
                  />
                  {value === 'email' ? t('email') : t('sms')}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-1 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('applied')}</p>
            <output className="block break-words text-sm" aria-live="polite" aria-label={t('applied')}>
              {applied ? `${appliedDensity} · ${appliedChannels}` : t('noChoices')}
            </output>
          </div>
        </ExampleSection>
        <ExampleSection title={t('menu')} description={t('menuHelp')}>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                tabIndex={0}
                className="flex min-h-24 cursor-context-menu items-center gap-4 rounded-[var(--radius)] border border-dashed border-border px-5 py-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                  <ClipboardList aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t('sampleRecord')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('contextTrigger')}</p>
                </div>
                <Menu aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => setMenuResult('Inspected demo-7')}>{t('inspect')}</ContextMenuItem>
                {allowArchive && (
                  <ContextMenuItem onSelect={() => setMenuResult('Archived demo-7')}>{t('archive')}</ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenu>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm" htmlFor={`${id}-archive`}>
            <Checkbox
              id={`${id}-archive`}
              checked={allowArchive}
              onCheckedChange={value => setAllowArchive(value === true)}
            />
            {t('allowArchive')}
          </label>
          <output
            className="block break-words border-t border-border pt-3 text-sm text-muted-foreground"
            aria-live="polite"
            aria-label={t('menuResult')}
          >
            {localize(menuResult)}
          </output>
        </ExampleSection>
        <ExampleSection title={t('tooltipTitle')} description={t('tooltipHelp')}>
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip content={t('tooltip')}>
              <Button type="button" variant="outline">
                <CircleHelp aria-hidden="true" className="size-4" />
                {t('tooltipButton')}
              </Button>
            </Tooltip>
            <span className="text-sm text-muted-foreground">{t('tooltipInteraction')}</span>
          </div>
        </ExampleSection>
      </div>
      <ExampleDetails title={t('implementation')}>
        <p>{t('help')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}
