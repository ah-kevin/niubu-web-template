import { describe, expect, it } from 'vitest';
import { formatDateOnly, formatInstant, formatCurrency, formatQuantity, formatLocalDateTime, parseLocalInstant } from './formatters';
import { businessDateAt } from '@niubu/core-shared';
describe('explicit display formatters preserve facts', () => {
  it('uses a UTC calendar carrier with medium dates and validates real calendar days', () => {
    expect(formatDateOnly('2026-10-11', { locale: 'en-US' })).toBe('Oct 11, 2026');
    expect(formatDateOnly('2026-10-11', { locale: 'zh-CN' })).toBe('2026年10月11日');
    expect(formatDateOnly('2024-02-29', { locale: 'en-US' })).toBe('Feb 29, 2024');
    for (const date of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-10-11T00:00:00Z', '26-10-11'])
      expect(() => formatDateOnly(date, { locale: 'en-US' })).toThrow(RangeError);
  });
  it('uses explicit instant zone and rejects offsets, invalid days, or absent offsets', () => {
    const iso = '2026-10-10T23:30:00Z';
    expect(formatInstant(iso, { locale: 'en-US', timeZone: 'UTC' })).toContain('Oct 10, 2026');
    expect(formatInstant(iso, { locale: 'en-US', timeZone: 'Asia/Shanghai' })).toContain('Oct 11, 2026');
    expect(businessDateAt(iso, 'Asia/Shanghai')).toBe('2026-10-11');
    expect(formatInstant('2026-10-11T07:30:00+08:00', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      formatInstant(iso, { locale: 'en-US', timeZone: 'UTC' }),
    );
    for (const value of [
      '2026-10-11T00:00:00',
      '2026-02-31T00:00:00Z',
      '2026-10-11T24:00:00Z',
      '2026-10-11T00:00:00+24:00',
      '2026-10-11T00:00:00+08:60',
    ])
      expect(formatInstant(value, { locale: 'en-US', timeZone: 'UTC' })).toBe('Time unknown');
    expect(formatInstant(iso, { locale: 'zh-CN', timeZone: 'bad-zone' })).toBe('时间未知');
  });
  it('preserves quality, zero, original unit, and source precision selection', () => {
    const options = { locale: 'en-US' as const, precision: 2, labels: { missing: 'Not measured', unknown: 'Unknown' } };
    const value = Object.freeze({ value: 0, unit: 'kg', quality: 'known' as const });
    expect(formatQuantity(value, options)).toBe('0.00 kg');
    expect(value.value).toBe(0);
    expect(formatQuantity({ value: null, unit: '元', quality: 'missing' }, options)).toBe('Not measured · 元');
    expect(formatQuantity({ value: NaN, unit: 'L', quality: 'known' }, options)).toBe('Unknown · L');
    expect(formatQuantity({ value: 12.345, unit: 'kg', quality: 'known' }, { ...options, precision: 1 })).toBe(
      '12.3 kg',
    );
  });
  it('requires explicit currency and precision independently of locale', () => {
    expect(formatCurrency(12, { locale: 'en-US', currency: 'CNY', precision: 2 })).toBe('CN¥12.00');
    expect(formatCurrency(12, { locale: 'en-US', currency: 'USD', precision: 0 })).toBe('$12');
    expect(() => formatCurrency(12, { locale: 'en-US', currency: '', precision: 2 })).toThrow(RangeError);
    expect(() =>
      formatQuantity(
        { value: 0, unit: 'kg', quality: 'known' },
        { locale: 'en-US', precision: -1, labels: { missing: 'm', unknown: 'u' } },
      ),
    ).toThrow(RangeError);
  });
});
it('never falls back to machine locale or machine timezone when an explicit option is missing', () => {
  expect(() => formatDateOnly('2026-10-11', { locale: undefined } as never)).toThrow(RangeError);
  expect(formatInstant('2026-10-11T00:00:00Z', { locale: 'en-US', timeZone: undefined } as never)).toBe('Time unknown');
  expect(() => formatCurrency(12, { locale: undefined, currency: 'CNY', precision: 2 } as never)).toThrow(RangeError);
});

it('converts explicit IANA wall times independently from the OS and rejects DST ambiguity',()=>{
 expect(formatLocalDateTime(Date.parse('2026-10-25T00:00:00Z'),'Asia/Shanghai')).toBe('2026-10-25T08:00:00');
 expect(parseLocalInstant('2026-10-25T08:00','UTC')).toBe('2026-10-25T08:00:00.000Z');
 expect(parseLocalInstant('2026-07-01T08:00','America/New_York')).toBe('2026-07-01T12:00:00.000Z');
 expect(()=>parseLocalInstant('2026-11-01T01:30','America/New_York')).toThrow();
 expect(()=>parseLocalInstant('2026-03-08T02:30','America/New_York')).toThrow();
});

it('requires explicit nonempty runtime timezones for local wall-time conversion',()=>{
 for(const timeZone of [undefined as never,'']) {
  expect(()=>formatLocalDateTime(Date.parse('2026-10-25T00:00:00Z'),timeZone)).toThrow(RangeError);
  expect(()=>parseLocalInstant('2026-10-25T08:00',timeZone)).toThrow(RangeError);
 }
});
