import type { Measure } from '@niubu/core-typings';

export function measureQuality(measure: Measure): Measure['quality'] {
  if (measure.quality === 'missing') return 'missing';
  return measure.quality === 'unknown' || measure.value === null || !Number.isFinite(measure.value)
    ? 'unknown'
    : 'known';
}
export function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Invalid calendar date');
  const [, year, month, day] = match.map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new RangeError('Invalid calendar date');
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
/** Strict offset-bearing instant validation, before JS Date can normalize invalid input. */
export function parseInstant(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) throw new RangeError('Offset-bearing ISO instant required');
  parseCalendarDate(match[1]);
  if (
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4]) > 59 ||
    Number(match[6] ?? 0) > 23 ||
    Number(match[7] ?? 0) > 59
  )
    throw new RangeError('Invalid instant');
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Invalid instant');
  return instant;
}
/** Business date remains a fact derived solely from an instant and explicit business zone. */
export function businessDateAt(iso: string, timeZone: string): string {
  if (typeof timeZone !== 'string' || !timeZone) throw new RangeError('Explicit business time zone required');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parseInstant(iso));
  const get = (key: string) => parts.find(part => part.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
