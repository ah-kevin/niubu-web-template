import { expect, it } from 'vitest';
import { formatInstant, formatQuantity } from './formatters';
it('retains the legacy zero, missing, unknown and original-unit cases at the locale owner', () => {
  const labels = { missing: '未测量', unknown: '未知' };
  expect(formatQuantity({ value: 0, unit: 'kg', quality: 'known' }, { locale: 'zh-CN', precision: 0, labels })).toBe(
    '0 kg',
  );
  expect(
    formatQuantity({ value: null, unit: 'kg', quality: 'missing' }, { locale: 'zh-CN', precision: 0, labels }),
  ).toBe('未测量 · kg');
  expect(
    formatQuantity({ value: null, unit: 'kg', quality: 'unknown' }, { locale: 'zh-CN', precision: 0, labels }),
  ).toBe('未知 · kg');
  expect(formatQuantity({ value: 12.5, unit: '元', quality: 'known' }, { locale: 'zh-CN', precision: 1, labels })).toBe(
    '12.5 元',
  );
  expect(
    formatQuantity({ value: Number.NaN, unit: 'kg', quality: 'known' }, { locale: 'zh-CN', precision: 0, labels }),
  ).toBe('未知 · kg');
});
it('retains explicit-zone and invalid-instant display cases at the locale owner', () => {
  const iso = '2026-10-11T02:00:00Z';
  expect(formatInstant(iso, { locale: 'zh-CN', timeZone: 'Asia/Shanghai' })).toBe(
    '2026年10月11日 10:00:00 · Asia/Shanghai',
  );
  expect(formatInstant(iso, { locale: 'zh-CN', timeZone: 'America/New_York' })).toBe(
    '2026年10月10日 22:00:00 · America/New_York',
  );
  expect(formatInstant(iso, { locale: 'zh-CN', timeZone: 'UTC' })).toBe('2026年10月11日 02:00:00 · UTC');
  expect(formatInstant('2026-02-31T00:00:00Z', { locale: 'zh-CN', timeZone: 'UTC' })).toBe('时间未知');
  expect(formatInstant('not-a-time', { locale: 'zh-CN', timeZone: 'UTC' })).toBe('时间未知');
});
