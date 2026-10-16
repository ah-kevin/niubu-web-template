import { expect, it } from 'vitest';
import { corePreferenceDefaults } from '@niubu/core-preferences';
import { buildEffectiveConfiguration, copyEffectiveConfiguration } from './configuration.ts';

it('exports validated core and only caller supplied extension schemas and values', () => {
  const text = buildEffectiveConfiguration({ ...corePreferenceDefaults, token: 'private', copyright: { companyName: '' } }, [{
    namespace: 'sample.cards', version: 3, value: { layout: 'wide', rows: ['private'] },
    validate: value => ({ layout: (value as { layout?: unknown }).layout === 'wide' ? 'wide' : 'balanced' }),
  }]);
  expect(JSON.parse(text)).toEqual({ schemaVersion: 1, core: { ...corePreferenceDefaults, copyright: { ...corePreferenceDefaults.copyright, companyName: '' } }, extensions: { 'sample.cards': { version: 3, value: { layout: 'wide' } } } });
  expect(text).not.toContain('private');
});

it('retains the exact copy text when clipboard is absent or refuses access', async () => {
  const text = 'configuration';
  expect(await copyEffectiveConfiguration(text)).toEqual({ ok: false, text });
  expect(await copyEffectiveConfiguration(text, { writeText: async () => { throw Error('denied'); } })).toEqual({ ok: false, text });
  let copied = '';
  expect(await copyEffectiveConfiguration(text, { writeText: async value => { copied = value; } })).toEqual({ ok: true, text });
  expect(copied).toBe(text);
});
