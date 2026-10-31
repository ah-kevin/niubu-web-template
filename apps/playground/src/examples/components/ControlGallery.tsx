import { useId, useState, type CSSProperties } from 'react';
import { densityTokens, resolvePresentationTheme } from '@niubu/core-design';
import { Plus } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Textarea } from '@niubu/shadcn-ui/textarea';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@niubu/shadcn-ui/radio-group';
import { Switch } from '@niubu/shadcn-ui/switch';
import { Slider } from '@niubu/shadcn-ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@niubu/shadcn-ui/tabs';
import { Badge } from '@niubu/shadcn-ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@niubu/shadcn-ui/card';
import { Divider, Separator } from '@niubu/shadcn-ui/separator';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@niubu/shadcn-ui/pagination';
import { ScrollArea, ScrollBar } from '@niubu/shadcn-ui/scroll-area';
import { Label } from '@niubu/shadcn-ui/label';
import { BusinessPortalBoundary } from '@niubu/shadcn-ui/business-portal-boundary';
import { ExampleSection } from '../ExamplePage';
import { useComponentsText } from './copy';

export function ControlGallery() {
  const { t } = useComponentsText();
  const id = useId();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [density, setDensity] = useState<'standard' | 'compact'>('standard');
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState<number | null>(2);
  const [draft, setDraft] = useState('01.20');
  const [choice, setChoice] = useState('a');
  const [checked, setChecked] = useState(false);
  const [mixed, setMixed] = useState<boolean | 'indeterminate'>('indeterminate');
  const [radio, setRadio] = useState('a');
  const [enabled, setEnabled] = useState(true);
  const [slider, setSlider] = useState([40]);
  const [count, setCount] = useState(98);
  const [selected, setSelected] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const style = {
    ...resolvePresentationTheme({}, theme),
    ...densityTokens[density],
    colorScheme: theme,
  } as CSSProperties;
  const fieldError = errors ? t('fieldError') : undefined;
  const errorText = (field: string) =>
    errors && (
      <p id={`${id}-${field}-error`} className="text-caption text-destructive-text">
        {fieldError}
      </p>
    );
  return (
    <section
      aria-label={t('galleryTitle')}
      data-control-gallery
      data-theme={theme}
      data-density={density}
      className={`${theme === 'dark' ? 'dark ' : ''}grid min-w-0 gap-4 rounded-[var(--control-radius-lg)] border border-border bg-background p-4 text-foreground`}
      style={style}
    >
      <header className="grid gap-3">
        <h2 className="text-heading-2 font-semibold">{t('galleryTitle')}</h2>
        <p className="text-muted-foreground">{t('galleryHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t('previewTheme')} className="flex gap-2">
            {(['light', 'dark'] as const).map(value => (
              <Button
                key={value}
                type="button"
                variant={theme === value ? 'default' : 'outline'}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                {t(value)}
              </Button>
            ))}
          </div>
          <div role="group" aria-label={t('previewDensity')} className="flex gap-2">
            {(['standard', 'compact'] as const).map(value => (
              <Button
                key={value}
                type="button"
                variant={density === value ? 'default' : 'outline'}
                aria-pressed={density === value}
                onClick={() => setDensity(value)}
              >
                {t(value)}
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
          ).map(([value, setter, key]) => (
            <label key={String(key)} className="inline-flex items-center gap-2">
              <Switch checked={value} onCheckedChange={setter} />
              {t(key)}
            </label>
          ))}
        </div>
      </header>
      <BusinessPortalBoundary locked={false}>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
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
          <ExampleSection title={t('textTitle')}>
            <Label htmlFor={`${id}-input`}>{t('inputLabel')}</Label>
            <Input
              id={`${id}-input`}
              placeholder={t('placeholder')}
              disabled={disabled}
              aria-invalid={errors || undefined}
              aria-describedby={errors ? `${id}-input-error` : undefined}
            />
            {errorText('input')}
          </ExampleSection>
          <ExampleSection title={t('textareaTitle')}>
            <Label htmlFor={`${id}-textarea`}>{t('textLabel')}</Label>
            <Textarea
              id={`${id}-textarea`}
              placeholder={t('placeholder')}
              disabled={disabled}
              aria-invalid={errors || undefined}
              aria-describedby={errors ? `${id}-textarea-error` : undefined}
            />
            {errorText('textarea')}
          </ExampleSection>
          <ExampleSection title={t('numberTitle')}>
            <Label htmlFor={`${id}-quantity`}>{t('quantity')}</Label>
            <NumberInput
              id={`${id}-quantity`}
              controls
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
            <Label htmlFor={`${id}-draft`}>{t('decimalDraft')}</Label>
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
          <ExampleSection title={t('selectTitle')}>
            <Label htmlFor={`${id}-select`}>{t('selectLabel')}</Label>
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
          <ExampleSection title={t('checkboxTitle')}>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={checked}
                onCheckedChange={value => setChecked(value === true)}
                disabled={disabled}
                aria-invalid={errors || undefined}
              />
              {t('checkLabel')}
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={mixed} onCheckedChange={setMixed} disabled={disabled} />
              {t('mixedLabel')}
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setMixed(value => (value === 'indeterminate' ? true : value ? false : 'indeterminate'))}
            >
              {t('cycleMixed')}
            </Button>
            {errorText('checkbox')}
          </ExampleSection>
          <ExampleSection title={t('radioTitle')}>
            <RadioGroup
              aria-label={t('radioLabel')}
              value={radio}
              onValueChange={setRadio}
              disabled={disabled}
              aria-invalid={errors || undefined}
            >
              {(['a', 'b'] as const).map(value => (
                <label key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} aria-invalid={errors || undefined} />
                  {t(value === 'a' ? 'radioA' : 'radioB')}
                </label>
              ))}
            </RadioGroup>
            {errorText('radio')}
          </ExampleSection>
          <ExampleSection title={t('switchTitle')}>
            <label className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={disabled} />
              {t('switchLabel')}
            </label>
          </ExampleSection>
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
            <Button type="button" variant="outline" disabled={disabled} onClick={() => setCount(value => value + 1)}>
              {t('moreNotifications')}
            </Button>
          </ExampleSection>
          <ExampleSection title={t('cardTitle')}>
            <Card interactive selected={selected}>
              <CardHeader>
                <CardTitle>{t('cardHeading')}</CardTitle>
                <CardDescription>{t('cardDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => setSelected(value => !value)}
                >
                  {t(selected ? 'clearCard' : 'selectCard')}
                </Button>
              </CardContent>
            </Card>
          </ExampleSection>
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
          <ExampleSection title={t('paginationTitle')}>
            <Pagination aria-label={t('paginationLabel')}>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-label={t('previous')}
                    disabled={disabled || page === 1}
                    onClick={event => {
                      event.preventDefault();
                      setPage(value => value - 1);
                    }}
                  >
                    {t('previous')}
                  </PaginationPrevious>
                </PaginationItem>
                {[1, 2, 3, 4, 5].map(value => (
                  <PaginationItem key={value}>
                    <PaginationLink
                      href="#"
                      aria-label={t('pageLabel', { page: value })}
                      isActive={page === value}
                      disabled={disabled}
                      onClick={event => {
                        event.preventDefault();
                        setPage(value);
                      }}
                    >
                      {value}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-label={t('next')}
                    disabled={disabled || page === 5}
                    onClick={event => {
                      event.preventDefault();
                      setPage(value => value + 1);
                    }}
                  >
                    {t('next')}
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <output aria-live="polite">{t('pageResult', { page })}</output>
          </ExampleSection>
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
            <p className="text-caption text-muted-foreground">{t('labelHelp')}</p>
          </ExampleSection>
        </div>
      </BusinessPortalBoundary>
      <output aria-live="polite">{action && t('actionResult', { action })}</output>
    </section>
  );
}
