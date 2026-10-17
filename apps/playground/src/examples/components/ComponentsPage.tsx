import { useComponentsText } from './copy';
import { useId, useState } from 'react';
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
    <main className="example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[12px] [&>h1]:text-[24px] [&>h1]:font-semibold [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-semibold">
      <h1>{t('title')}</h1>
      <p>{t('help')}</p>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('choices')}</h2>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">{t('density')}</legend>
          <RadioGroup
            className="flex flex-wrap gap-x-6 gap-y-3"
            aria-label={t('density')}
            value={density}
            onValueChange={setDensity}
          >
            {(['compact', 'comfortable'] as const).map(value => (
              <label
                className="inline-flex cursor-pointer items-center gap-2 text-sm"
                key={value}
                htmlFor={`${id}-${value}`}
              >
                <RadioGroupItem id={`${id}-${value}`} value={value} />
                {value === 'compact' ? t('compact') : t('comfortable')}
              </label>
            ))}
          </RadioGroup>
        </fieldset>
        <fieldset className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          <legend className="mb-2 text-sm font-medium">{t('channels')}</legend>
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
        </fieldset>
        <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
          <Button type="button" onClick={() => setApplied({ density, channels })}>
            {t('apply')}
          </Button>
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
        </div>
        <output className="rounded-lg bg-muted/40 px-3 py-2 text-sm" aria-live="polite" aria-label={t('applied')}>
          {applied ? `${appliedDensity} · ${appliedChannels}` : t('noChoices')}
        </output>
      </section>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('menu')}</h2>
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm" htmlFor={`${id}-archive`}>
          <Checkbox
            id={`${id}-archive`}
            checked={allowArchive}
            onCheckedChange={value => setAllowArchive(value === true)}
          />
          {t('allowArchive')}
        </label>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              tabIndex={0}
              className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('contextTrigger')}
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
        <output className="rounded-lg bg-muted/40 px-3 py-2 text-sm" aria-live="polite" aria-label={t('menuResult')}>
          {localize(menuResult)}
        </output>
      </section>
      <section className="example-card my-4 min-w-0 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)] shadow-xs">
        <h2>{t('tooltipTitle')}</h2>
        <Tooltip content={t('tooltip')}>
          <Button type="button" variant="outline">
            {t('tooltipButton')}
          </Button>
        </Tooltip>
      </section>
    </main>
  );
}
