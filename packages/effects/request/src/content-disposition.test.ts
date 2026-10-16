import { expect, it } from 'vitest';
import { parseContentDispositionFilename } from './content-disposition';

it.each([
  [null, undefined, 'download'],
  [null, 'report.csv', 'report.csv'],
  ['attachment; filename="report.csv"', undefined, 'report.csv'],
])('uses a filename or safe fallback: %s', (header, fallback, expected) => {
  expect(parseContentDispositionFilename(header, fallback)).toBe(expected);
});

it.each([
  ['attachment; FILENAME="quarter; final.csv"', 'fallback', 'quarter; final.csv'],
  ['attachment; filename="a\\"b.csv"', 'fallback', 'ab.csv'],
  ['attachment; filename="a\\\\b.csv"', 'fallback', 'b.csv'],
  ['attachment; filename=report.csv', 'fallback', 'report.csv'],
  ['attachment; filename="ascii.csv"; filename*=UTF-8\'zh\'%E4%B8%AD%E6%96%87.csv', 'fallback', '中文.csv'],
  ['attachment; filename="ascii.csv"; FILENAME*=utf-8\'\'extended.csv', 'fallback', 'extended.csv'],
  ['attachment; filename="ascii.csv"; filename*=UTF-8\'\'%ZZ', 'fallback', 'ascii.csv'],
  ['attachment; filename="ascii.csv"; filename*=UTF-8\'\'%C0%AF', 'fallback', 'ascii.csv'],
  ['attachment; filename="ascii.csv"; filename*=ISO-8859-1\'\'%A3.csv', 'fallback', 'ascii.csv'],
  ['attachment; filename="ascii.csv"; filename*="UTF-8\'\'bad.csv"', 'fallback', 'ascii.csv'],
  ['attachment; filename="ascii.csv"; filename*=UTF-8\'\'raw name.csv', 'fallback', 'ascii.csv'],
  ['attachment; filename="one"; FILENAME="two"', 'fallback', 'fallback'],
  ['attachment; filename="ascii.csv"; filename*=UTF-8\'\'one; filename*=UTF-8\'\'two', 'fallback', 'ascii.csv'],
  ['attachment; filename="one"; filename="two"; filename*=UTF-8\'\'extended.csv', 'fallback', 'extended.csv'],
  ['attachment; filename="unterminated', 'fallback', 'fallback'],
  ['attachment; filename="a" trailing', 'fallback', 'fallback'],
  ['attachment; filename="../../secret.csv"', 'fallback', 'secret.csv'],
  ['attachment; filename*=UTF-8\'\'..%2F..%5Csecret.csv', 'fallback', 'secret.csv'],
  ['attachment; filename="a\u0000\r\n\u007fb<>:|?*.csv"', 'fallback', 'ab.csv'],
  ['attachment; filename=" . "', 'fallback', 'fallback'],
  ['attachment; filename=".."', 'fallback', 'fallback'],
  ['attachment; filename=""', '../../fallback.csv', 'fallback.csv'],
  [null, '../..', 'download'],
  [null, '\u0000<>:"|?*', 'download'],
  [null, ' /tmp/ name.csv ', 'name.csv'],
])('parses and sanitizes RFC filename safely: %s', (header, fallback, expected) => {
  expect(parseContentDispositionFilename(header, fallback)).toBe(expected);
});
