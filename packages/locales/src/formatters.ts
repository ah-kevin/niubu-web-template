import zhCommon from './resources/zh-CN/common.json';
import enCommon from './resources/en-US/common.json';
import type { Measure } from '@niubu/core-typings';
import type { Locale } from '@niubu/hooks';
import { measureQuality, parseCalendarDate, parseInstant } from '@niubu/core-shared';
export type QuantityLabels = Readonly<{ missing: string; unknown: string }>;
function assertLocale(locale: Locale) {
  if (locale !== 'zh-CN' && locale !== 'en-US') throw new RangeError('Explicit supported locale required');
}
function precisionOptions(precision: number) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 20)
    throw new RangeError('Precision must be an integer from 0 to 20');
  return { minimumFractionDigits: precision, maximumFractionDigits: precision };
}
export function formatDateOnly(value: string, { locale }: { locale: Locale }): string {
  assertLocale(locale);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(parseCalendarDate(value));
}
export function formatInstant(value: string, { locale, timeZone }: { locale: Locale; timeZone: string }): string {
  assertLocale(locale);
  try {
    if (typeof timeZone !== 'string' || !timeZone) throw new RangeError('Explicit time zone required');
    return `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone, hourCycle: 'h23' }).format(parseInstant(value))} · ${timeZone}`;
  } catch {
    return (locale === 'en-US' ? enCommon : zhCommon)['time.unknown'];
  }
}
export function formatCurrency(
  value: number,
  { locale, currency, precision }: { locale: Locale; currency: string; precision: number },
): string {
  assertLocale(locale);
  if (!Number.isFinite(value)) throw new RangeError('Currency value must be finite');
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError('Explicit ISO currency required');
  return new Intl.NumberFormat(locale, { style: 'currency', currency, ...precisionOptions(precision) }).format(value);
}
export function formatQuantity(
  measure: Measure,
  { locale, precision, labels }: { locale: Locale; precision: number; labels: QuantityLabels },
): string {
  assertLocale(locale);
  const options = precisionOptions(precision);
  const quality = measureQuality(measure);
  if (quality !== 'known') return `${labels[quality]}${measure.unit ? ` · ${measure.unit}` : ''}`;
  return `${new Intl.NumberFormat(locale, options).format(measure.value!)}${measure.unit ? ` ${measure.unit}` : ''}`;
}
