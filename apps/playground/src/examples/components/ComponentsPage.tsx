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
  const [applied, setApplied] = useState('No choices applied');
  const [allowArchive, setAllowArchive] = useState(false);
  const [menuResult, setMenuResult] = useState('No menu action');
  return (
    <main className="example-page">
      <h1>{t('title')}</h1>
      <p>{t('help')}</p>
      <section className="example-card">
        <h2>{t('choices')}</h2>
        <RadioGroup aria-label={t('density')} value={density} onValueChange={setDensity}>
          {(['compact', 'comfortable'] as const).map(value => (
            <label key={value} htmlFor={`${id}-${value}`}>
              <RadioGroupItem id={`${id}-${value}`} value={value} />
              {value === 'compact' ? t('compact') : t('comfortable')}
            </label>
          ))}
        </RadioGroup>
        <fieldset>
          <legend>{t('channels')}</legend>
          {(['email', 'sms'] as const).map(value => (
            <label key={value} htmlFor={`${id}-${value}`}>
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
        <div className="example-toolbar">
          <Button type="button" onClick={() => setApplied(`${density} · ${channels.join(', ') || 'none'}`)}>
            {t('apply')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDensity('compact');
              setChannels([]);
              setApplied('No choices applied');
            }}
          >
            {t('reset')}
          </Button>
        </div>
        <output aria-label={t('applied')}>{localize(applied)}</output>
      </section>
      <section className="example-card">
        <h2>{t('menu')}</h2>
        <label htmlFor={`${id}-archive`}>
          <Checkbox
            id={`${id}-archive`}
            checked={allowArchive}
            onCheckedChange={value => setAllowArchive(value === true)}
          />
          {t('allowArchive')}
        </label>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div tabIndex={0} className="rounded border p-4">
              {t('contextTrigger')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuPortal>
            <ContextMenuContent className="rounded border bg-background p-2 shadow">
              <ContextMenuItem onSelect={() => setMenuResult('Inspected demo-7')}>{t('inspect')}</ContextMenuItem>
              {allowArchive && (
                <ContextMenuItem onSelect={() => setMenuResult('Archived demo-7')}>{t('archive')}</ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenuPortal>
        </ContextMenu>
        <output aria-label={t('menuResult')}>{localize(menuResult)}</output>
      </section>
      <section className="example-card">
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
