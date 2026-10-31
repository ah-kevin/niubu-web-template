import { useId, useState } from 'react';
import { usePreviewAppearance, type PreviewTheme, type PreviewDensity } from '../usePreviewAppearance';
import { CircleHelp, Plus, Search } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { Input, InputGroup, InputGroupAddon } from '@niubu/shadcn-ui/input';
import { Textarea } from '@niubu/shadcn-ui/textarea';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@niubu/shadcn-ui/radio-group';
import { Switch } from '@niubu/shadcn-ui/switch';
import { Slider } from '@niubu/shadcn-ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@niubu/shadcn-ui/tabs';
import { Badge } from '@niubu/shadcn-ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@niubu/shadcn-ui/card';
import { Divider, Separator } from '@niubu/shadcn-ui/separator';
import { Pagination } from '@niubu/common-ui/pagination';
import { ScrollArea, ScrollBar } from '@niubu/shadcn-ui/scroll-area';
import { Label } from '@niubu/shadcn-ui/label';
import { Tooltip } from '@niubu/shadcn-ui/tooltip';
import { BusinessPortalBoundary } from '@niubu/shadcn-ui/business-portal-boundary';
import { ExampleSection } from '../ExamplePage';
import { useComponentsText } from './copy';

import { controlGalleryTitles, type ControlGalleryKind } from './control-kinds';
export type { ControlGalleryKind } from './control-kinds';

export function ControlGallery({ only }: { only?: ControlGalleryKind } = {}) {
  const { t } = useComponentsText();
  const id = useId();
  const [theme, setTheme] = useState<PreviewTheme>('global');
  const [density, setDensity] = useState<PreviewDensity>('global');
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState<number | null>(2);
  const [draft, setDraft] = useState('01.20');
  const [notes, setNotes] = useState('');
  const [choice, setChoice] = useState('a');
  const [checked, setChecked] = useState(false);
  const [mixed, setMixed] = useState<boolean | 'indeterminate'>('indeterminate');
  const [regions, setRegions] = useState<string[]>([]);
  const [radio, setRadio] = useState('a');
  const [enabled, setEnabled] = useState(true);
  const [slider, setSlider] = useState([40]);
  const [count, setCount] = useState(98);
  const [selected, setSelected] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const pages = Math.ceil(128 / pagination.pageSize);
  const [action, setAction] = useState('');
  const preview = usePreviewAppearance(theme, density);
  const fieldError = errors ? t('fieldError') : undefined;
  const errorText = (field: string) =>
    errors && (
      <p id={`${id}-${field}-error`} className="text-caption text-destructive-text">
        {fieldError}
      </p>
    );
  return (
    <section
      aria-label={only ? t(controlGalleryTitles[only]) : t('galleryTitle')}
      data-control-gallery
      data-theme={preview.theme}
      data-density={preview.density}
      className={`${theme === 'dark' ? 'dark ' : ''}grid min-w-0 gap-4 rounded-[var(--control-radius-lg)] border border-border bg-background p-4 text-foreground`}
      style={preview.style}
    >
      <header className="grid gap-3">
        <h2 className="text-heading-2 font-semibold">{only ? t(controlGalleryTitles[only]) : t('galleryTitle')}</h2>
        <p className="text-muted-foreground">{t('galleryHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t('previewTheme')} className="flex gap-2">
            {(['global', 'light', 'dark'] as const).map(value => (
              <Button
                key={value}
                type="button"
                variant={theme === value ? 'default' : 'outline'}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                {t(value === 'global' ? 'followGlobal' : value)}
              </Button>
            ))}
          </div>
          <div role="group" aria-label={t('previewDensity')} className="flex gap-2">
            {(['global', 'standard', 'compact'] as const).map(value => (
              <Button
                key={value}
                type="button"
                variant={density === value ? 'default' : 'outline'}
                aria-pressed={density === value}
                onClick={() => setDensity(value)}
              >
                {t(value === 'global' ? 'followGlobal' : value)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {(
            [
              [disabled, setDisabled, 'disabledState'],
              [errors, setErrors, 'errorState'],
              [loading, setLoading, 'loadingState'],
            ] as const
          )
            .filter(
              ([, , key]) =>
                !only ||
                (key === 'loadingState'
                  ? only === 'Button'
                  : key === 'errorState'
                    ? ['Input', 'Textarea', 'NumberInput', 'Select', 'Checkbox', 'Radio'].includes(only)
                    : !['Badge', 'Divider', 'ScrollArea'].includes(only)),
            )
            .map(([value, setter, key]) => (
              <label key={String(key)} className="inline-flex items-center gap-2">
                <Switch checked={value} onCheckedChange={setter} />
                {t(key)}
              </label>
            ))}
        </div>
      </header>
      <BusinessPortalBoundary locked={false}>
        <div className={only ? 'grid min-w-0 gap-4' : 'grid min-w-0 gap-4 xl:grid-cols-2'}>
          {(!only || only === 'Button') && (
            <ExampleSection title={t('buttonsTitle')}>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['default', 'primaryButton'],
                    ['outline', 'outlineButton'],
                    ['ghost', 'ghostButton'],
                    ['destructive', 'dangerButton'],
                    ['link', 'linkButton'],
                    ['link-danger', 'dangerLink'],
                  ] as const
                ).map(([variant, key]) => (
                  <Button
                    key={variant}
                    type="button"
                    variant={variant}
                    disabled={disabled || loading}
                    aria-busy={loading}
                    onClick={() => setAction(t(key))}
                  >
                    {loading && (
                      <span
                        aria-hidden
                        className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                      />
                    )}
                    {t(key)}
                  </Button>
                ))}
                <Button type="button" size="sm" disabled={disabled} onClick={() => setAction(t('smallButton'))}>
                  {t('smallButton')}
                </Button>
                <Button type="button" size="lg" disabled={disabled} onClick={() => setAction(t('largeButton'))}>
                  {t('largeButton')}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  aria-label={t('iconButton')}
                  disabled={disabled}
                  onClick={() => setCount(value => value + 1)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </ExampleSection>
          )}
          {(!only || only === 'Input') && (
            <ExampleSection title={t('textTitle')}>
              <Label htmlFor={`${id}-input`} data-disabled={disabled ? '' : undefined}>
                {t('inputLabel')}
              </Label>
              <Input
                id={`${id}-input`}
                placeholder={t('placeholder')}
                disabled={disabled}
                aria-invalid={errors || undefined}
                aria-describedby={errors ? `${id}-input-error` : undefined}
              />
              {errorText('input')}
              <Label htmlFor={`${id}-search`} data-disabled={disabled ? '' : undefined}>
                {t('searchLabel')}
              </Label>
              <InputGroup>
                <InputGroupAddon aria-hidden="true">
                  <Search />
                </InputGroupAddon>
                <Input
                  id={`${id}-search`}
                  type="search"
                  placeholder={t('searchPlaceholder')}
                  disabled={disabled}
                  aria-invalid={errors || undefined}
                  aria-describedby={errors ? `${id}-input-error` : undefined}
                />
                <InputGroupAddon aria-hidden="true">
                  <kbd>⌘K</kbd>
                </InputGroupAddon>
              </InputGroup>
            </ExampleSection>
          )}
          {(!only || only === 'Textarea') && (
            <ExampleSection title={t('textareaTitle')}>
              <Label htmlFor={`${id}-textarea`} data-disabled={disabled ? '' : undefined}>
                {t('textLabel')}
              </Label>
              <Textarea
                id={`${id}-textarea`}
                placeholder={t('placeholder')}
                disabled={disabled}
                aria-invalid={errors || undefined}
                value={notes}
                onChange={event => setNotes(event.currentTarget.value)}
                maxLength={200}
                aria-describedby={[`${id}-textarea-count`, errors ? `${id}-textarea-error` : undefined]
                  .filter(Boolean)
                  .join(' ')}
              />
              <output id={`${id}-textarea-count`} className="text-caption text-muted-foreground">
                {t('textCount', { count: notes.length })}
              </output>
              {errorText('textarea')}
            </ExampleSection>
          )}
          {(!only || only === 'NumberInput') && (
            <ExampleSection title={t('numberTitle')}>
              <Label htmlFor={`${id}-quantity`} data-disabled={disabled ? '' : undefined}>
                {t('quantity')}
              </Label>
              <NumberInput
                id={`${id}-quantity`}
                controls
                unit={t('unitKg')}
                decreaseLabel={t('decrease')}
                increaseLabel={t('increase')}
                value={quantity}
                onValueChange={setQuantity}
                min={0}
                max={5}
                disabled={disabled}
                aria-invalid={errors || undefined}
                aria-describedby={errors ? `${id}-number-error` : undefined}
              />
              {errorText('number')}
              <Label htmlFor={`${id}-draft`} data-disabled={disabled ? '' : undefined}>
                {t('decimalDraft')}
              </Label>
              <NumberInput
                id={`${id}-draft`}
                controls
                decreaseLabel={t('decreaseDraft')}
                increaseLabel={t('increaseDraft')}
                valueMode="string"
                value={draft}
                onValueChange={setDraft}
                step={0.1}
                disabled={disabled}
              />
              <output aria-label={t('decimalDraft')}>{draft}</output>
            </ExampleSection>
          )}
          {(!only || only === 'Select') && (
            <ExampleSection title={t('selectTitle')}>
              <Label htmlFor={`${id}-select`} data-disabled={disabled ? '' : undefined}>
                {t('selectLabel')}
              </Label>
              <Select
                id={`${id}-select`}
                label={t('selectLabel')}
                value={choice}
                onValueChange={setChoice}
                disabled={disabled}
                aria-invalid={errors || undefined}
                aria-describedby={errors ? `${id}-select-error` : undefined}
                options={[
                  { value: '', label: t('optionNone') },
                  { value: 'a', label: t('optionA') },
                  { value: 'b', label: t('optionB') },
                  { value: 'disabled', label: t('optionDisabled'), disabled: true },
                ]}
              />
              {errorText('select')}
            </ExampleSection>
          )}
          {(!only || only === 'Checkbox') && (
            <ExampleSection title={t('checkboxTitle')}>
              <Label className="flex items-center gap-2" data-disabled={disabled ? '' : undefined}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={value => setChecked(value === true)}
                  disabled={disabled}
                  aria-invalid={errors || undefined}
                />
                {t('checkLabel')}
              </Label>
              <Label className="flex items-center gap-2" data-disabled={disabled ? '' : undefined}>
                <Checkbox checked={mixed} onCheckedChange={setMixed} disabled={disabled} />
                {t('mixedLabel')}
              </Label>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => setMixed(value => (value === 'indeterminate' ? true : value ? false : 'indeterminate'))}
              >
                {t('cycleMixed')}
              </Button>
              {errorText('checkbox')}
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">{t('regions')}</legend>
                <Label data-disabled={disabled ? '' : undefined}>
                  <Checkbox
                    checked={regions.length === 2 ? true : regions.length ? 'indeterminate' : false}
                    onCheckedChange={value => setRegions(value === true ? ['a', 'b'] : [])}
                    disabled={disabled}
                    aria-invalid={errors || undefined}
                  />
                  {t('selectAllRegions')}
                </Label>
                {(['a', 'b'] as const).map(value => (
                  <Label key={value} data-disabled={disabled ? '' : undefined}>
                    <Checkbox
                      checked={regions.includes(value)}
                      disabled={disabled}
                      aria-invalid={errors || undefined}
                      onCheckedChange={checked =>
                        setRegions(previous =>
                          checked === true ? [...previous, value] : previous.filter(region => region !== value),
                        )
                      }
                    />
                    {t(value === 'a' ? 'regionA' : 'regionB')}
                  </Label>
                ))}
              </fieldset>
            </ExampleSection>
          )}
          {(!only || only === 'Radio') && (
            <ExampleSection title={t('radioTitle')}>
              <RadioGroup
                aria-label={t('radioLabel')}
                value={radio}
                onValueChange={setRadio}
                disabled={disabled}
                aria-invalid={errors || undefined}
              >
                {(['a', 'unavailable', 'b'] as const).map(value => (
                  <Label
                    key={value}
                    className="flex items-center gap-2"
                    data-disabled={disabled || value === 'unavailable' ? '' : undefined}
                  >
                    <RadioGroupItem
                      value={value}
                      disabled={disabled || value === 'unavailable'}
                      aria-invalid={errors || undefined}
                    />
                    {t(value === 'a' ? 'radioA' : value === 'b' ? 'radioB' : 'radioUnavailable')}
                  </Label>
                ))}
              </RadioGroup>
              {errorText('radio')}
            </ExampleSection>
          )}
          {(!only || only === 'Switch') && (
            <ExampleSection title={t('switchTitle')}>
              <Label className="flex items-center gap-2" data-disabled={disabled ? '' : undefined}>
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={disabled} />
                {t('switchLabel')}
              </Label>
            </ExampleSection>
          )}
          {(!only || only === 'Slider') && (
            <ExampleSection title={t('sliderTitle')}>
              <Slider
                aria-label={t('sliderLabel')}
                value={slider}
                onValueChange={setSlider}
                min={0}
                max={100}
                disabled={disabled}
              />
              <output className="text-muted-foreground tabular-nums">{slider[0]}%</output>
            </ExampleSection>
          )}
          {(!only || only === 'Tabs') && (
            <ExampleSection title={t('tabsTitle')}>
              {(['line', 'segmented'] as const).map(variant => (
                <Tabs key={variant} defaultValue="a">
                  <TabsList variant={variant} aria-label={t(variant === 'line' ? 'lineTabs' : 'segmentedTabs')}>
                    <TabsTrigger value="a" disabled={disabled}>
                      {t('tabA')}
                    </TabsTrigger>
                    <TabsTrigger value="b" disabled={disabled}>
                      {t('tabB')}
                    </TabsTrigger>
                    <TabsTrigger value="disabled" disabled>
                      {t('tabDisabled')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="a">{t('panelA')}</TabsContent>
                  <TabsContent value="b">{t('panelB')}</TabsContent>
                </Tabs>
              ))}
            </ExampleSection>
          )}
          {(!only || only === 'Badge') && (
            <ExampleSection title={t('badgeTitle')}>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['neutral', 'neutral'],
                    ['primary', 'primaryStatus'],
                    ['success', 'successStatus'],
                    ['warning', 'warningStatus'],
                    ['info', 'infoStatus'],
                    ['danger', 'dangerStatus'],
                    ['outline', 'outlineButton'],
                  ] as const
                ).map(([variant, key]) => (
                  <Badge key={variant} variant={variant}>
                    {t(key)}
                  </Badge>
                ))}
                <Badge count={count} aria-label={t('notificationCount', { count })} />
                <Badge dot aria-label={t('newContent')} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['success', 'online'],
                    ['neutral', 'offline'],
                    ['warning', 'warningDot'],
                    ['danger', 'fault'],
                  ] as const
                ).map(([variant, key]) => (
                  <Badge key={key} variant={variant}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t(key)}
                  </Badge>
                ))}
              </div>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setCount(value => value + 1)}>
                {t('moreNotifications')}
              </Button>
            </ExampleSection>
          )}
          {(!only || only === 'Card') && (
            <ExampleSection title={t('cardTitle')}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{t('summaryCard')}</CardTitle>
                    <Button type="button" variant="link" disabled={disabled} onClick={() => setAction(t('allRecords'))}>
                      {t('allRecords')}
                    </Button>
                  </div>
                  <CardDescription>{t('summaryDescription')}</CardDescription>
                </CardHeader>
                <CardContent>{t('summaryContent')}</CardContent>
                <CardFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => setAction(t('exportSummary'))}
                  >
                    {t('exportSummary')}
                  </Button>
                  <Button type="button" disabled={disabled} onClick={() => setAction(t('viewSummary'))}>
                    {t('viewSummary')}
                  </Button>
                </CardFooter>
              </Card>
              <Card
                interactive
                selected={selected}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={t(selected ? 'clearCard' : 'selectCard')}
                aria-pressed={selected}
                aria-disabled={disabled || undefined}
                className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                onClick={() => {
                  if (!disabled) setSelected(value => !value);
                }}
                onKeyDown={event => {
                  if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setSelected(value => !value);
                  }
                }}
              >
                <CardHeader>
                  <CardTitle>{t('cardHeading')}</CardTitle>
                  <CardDescription>{t('cardDescription')}</CardDescription>
                </CardHeader>
                <CardContent>{t(selected ? 'clearCard' : 'selectCard')}</CardContent>
              </Card>
            </ExampleSection>
          )}
          {(!only || only === 'Divider') && (
            <ExampleSection title={t('dividerTitle')}>
              <Divider />
              <Divider>{t('dividerText')}</Divider>
              <div className="flex h-8 items-center">
                <Button type="button" variant="link" disabled={disabled} onClick={() => setAction(t('actionOne'))}>
                  {t('actionOne')}
                </Button>
                <Separator orientation="vertical" />
                <Button type="button" variant="link" disabled={disabled} onClick={() => setAction(t('actionTwo'))}>
                  {t('actionTwo')}
                </Button>
              </div>
            </ExampleSection>
          )}
          {(!only || only === 'Pagination') && (
            <ExampleSection title={t('paginationTitle')}>
              <Pagination
                label={t('paginationLabel')}
                total={128}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                pageCount={pages}
                disabled={disabled}
                onPageChange={pageIndex => setPagination(current => ({ ...current, pageIndex }))}
                onPageSizeChange={pageSize => setPagination({ pageIndex: 0, pageSize })}
              />
              <h3 className="mt-4 text-sm font-medium">{t('simplePagination')}</h3>
              <Pagination
                label={t('simplePagination')}
                simple
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                pageCount={pages}
                disabled={disabled}
                onPageChange={pageIndex => setPagination(current => ({ ...current, pageIndex }))}
              />
              <output aria-live="polite">{t('pageResult', { page: pagination.pageIndex + 1, count: pages })}</output>
            </ExampleSection>
          )}
          {(!only || only === 'ScrollArea') && (
            <ExampleSection title={t('scrollTitle')}>
              <ScrollArea
                type="always"
                className="h-40 rounded-[var(--control-radius-lg)] border border-border bg-card"
                aria-label={t('verticalScroll')}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className="flex h-[var(--control-height-lg)] items-center border-b border-border px-[var(--workspace-card-padding)]"
                  >
                    {t('scrollItem', { number: i + 1 })}
                  </div>
                ))}
              </ScrollArea>
              <ScrollArea
                type="always"
                className="rounded-[var(--control-radius-lg)] border border-border bg-card"
                aria-label={t('horizontalScroll')}
              >
                <div className="flex w-max gap-6 p-4">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i}>{t('scrollItem', { number: i + 1 })}</span>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </ExampleSection>
          )}
          {(!only || only === 'Label') && (
            <ExampleSection title={t('labelTitle')}>
              <Label htmlFor={`${id}-required`} data-disabled={disabled ? '' : undefined}>
                {t('requiredLabel')}
                <span aria-hidden className="text-destructive-text">
                  *
                </span>
              </Label>
              <Input id={`${id}-required`} required disabled={disabled} />
              <Label htmlFor={`${id}-optional`} data-disabled={disabled ? '' : undefined}>
                {t('optionalLabel')}
                <span className="font-normal text-muted-foreground">{t('optional')}</span>
              </Label>
              <Input id={`${id}-optional`} disabled={disabled} />
              <div className="flex items-center gap-2">
                <Label htmlFor={`${id}-helped`} data-disabled={disabled ? '' : undefined}>
                  {t('hintLabel')}
                </Label>
                <Tooltip content={t('hintText')}>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t('hintText')}>
                    <CircleHelp aria-hidden />
                  </Button>
                </Tooltip>
              </div>
              <Input id={`${id}-helped`} disabled={disabled} />
              <p className="text-caption text-muted-foreground">{t('labelHelp')}</p>
            </ExampleSection>
          )}
        </div>
      </BusinessPortalBoundary>
      <output aria-live="polite">{action && t('actionResult', { action })}</output>
    </section>
  );
}
