import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRecords } from '@niubu/plugins/csv';

describe('pure local CSV parsing', () => {
  it('reports malformed quotes through both public contracts', () => {
    expect(parseCsv('name\n"unterminated').errors.length).toBeGreaterThan(0);
    expect(parseCsvRecords('name\n"unterminated').errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MissingQuotes', row: 1 })]));
  });
  it('preserves raw headers, BOM handling, quoted commas and whitespace for app validation', () => {
    expect(parseCsvRecords('\uFEFFname,name,\r\n"a,b", x ,\r\n')).toEqual({ headers: ['name', 'name', ''], records: [['a,b', ' x ', '']], errors: [] });
    expect(parseCsvRecords('name\n\n')).toEqual({ headers: ['name'], records: [['']], errors: [] });
    expect(parseCsvRecords('')).toEqual({ headers: [], records: [], errors: [] });
  });
  it('projects standard object rows without typing, trimming or domain validation', () => {
    expect(parseCsv('name,count\n"a,b",001\n x ,2\n')).toEqual({ rows: [{ name: 'a,b', count: '001' }, { name: ' x ', count: '2' }], errors: [] });
  });
});
