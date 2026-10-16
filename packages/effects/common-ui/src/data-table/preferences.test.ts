import { expect, it } from 'vitest';
import { tablePreferences } from './preferences';
it('isolates table display storage under the namespace supplied by each app', () => {
  const columns = ['id'];
  const first = tablePreferences('inventory', columns, 'alpha');
  const second = tablePreferences('inventory', columns, 'beta');
  expect(first.namespace).toBe('alpha.tables.inventory');
  expect(second.namespace).toBe('beta.tables.inventory');
  expect(first.namespace).not.toBe(second.namespace);
  expect(tablePreferences('inventory', columns, 'niubu').namespace).toBe('niubu.tables.inventory');
});
it('drops unknown columns, clamps widths, repairs all-hidden and de-duplicates logical pins', () => {
  const schema = tablePreferences('inventory', ['id', 'quantity'], 'template');
  expect(
    schema.validate({
      visibility: { id: false, quantity: false, stale: true },
      sizing: { id: 20, quantity: 999, stale: 180 },
      pinning: { start: ['id', 'id', 'stale'], end: ['id', 'quantity'] },
      rowSelection: { secret: true },
    }),
  ).toEqual({
    visibility: { id: true, quantity: false },
    sizing: { id: 80, quantity: 640 },
    pinning: { start: ['id'], end: ['quantity'] },
  });
});
it('never accepts reserved column IDs or persists rows, permissions, selection or stale widths', () => {
  for (const id of [...Object.getOwnPropertyNames(Object.prototype), 'prototype']) {
    expect(() => tablePreferences('inventory', [id, 'quantity'], 'template')).toThrow(/Column/);
  }
  const schema = tablePreferences('inventory', ['id'], 'template');
  expect(
    schema.validate({
      visibility: { ghost: false },
      sizing: { id: Infinity, ghost: 220 },
      pinning: { start: ['ghost'], end: [] },
      rows: [{ id: 'secret' }],
      rowSelection: { secret: true },
      permission: 'admin',
    }),
  ).toEqual({ visibility: {}, sizing: {}, pinning: { start: [], end: [] } });
});
it('validates default display values without accepting a scope inside the namespace', () => {
  const defaults = { visibility: { id: false }, sizing: { quantity: 999 }, pinning: { start: ['quantity'], end: [] } };
  const schema = tablePreferences('inventory', ['id', 'quantity'], 'template', defaults);
  expect(schema.defaults).toEqual({
    visibility: { id: false },
    sizing: { quantity: 640 },
    pinning: { start: ['quantity'], end: [] },
  });
  expect(() => tablePreferences('inventory:workspace-a', ['id'], 'template')).toThrow(/scope/);
});
