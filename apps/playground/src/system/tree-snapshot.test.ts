import { describe, expect, it } from 'vitest';
import * as schemas from './schemas';

const group = { id: 'group', title: 'Root', kind: 'group', parentId: null, order: 0, enabled: true };
const child = { id: 'child', title: 'Child', kind: 'page', pageId: 'playground.home', parentId: 'group', order: 1, enabled: true };
const snapshot = (rows: unknown[]) => ({ rows, rowCount: rows.length, complete: true });

describe('complete system tree snapshot decoder', () => {
  it('accepts the entire menu forest including disabled records', () => {
    expect(schemas.parseSystemTree('menus', snapshot([group, { ...child, enabled: false }]))).toEqual(snapshot([group, { ...child, enabled: false }]));
  });
  it('accepts a three-level department forest', () => {
    const rows = [
      { id: 'root', name: 'Root', code: 'root', parentId: null, enabled: true },
      { id: 'child', name: 'Child', code: 'child', parentId: 'root', enabled: true },
      { id: 'leaf', name: 'Leaf', code: 'leaf', parentId: 'child', enabled: false },
    ];
    expect(schemas.parseSystemTree('departments', snapshot(rows))).toEqual(snapshot(rows));
  });
  it.each([
    ...['constructor', 'prototype', '__proto__', 'toString'].map((id): [string, unknown] => [`unsafe tree id ${id}`, snapshot([{ ...group, id }])]),
    ['not complete', { ...snapshot([group]), complete: false }],
    ['missing complete', { rows: [group], rowCount: 1 }],
    ['truncated count', { ...snapshot([group]), rowCount: 2 }],
    ['duplicate ids', snapshot([group, group])],
    ['missing parent', snapshot([child])],
    ['self cycle', snapshot([{ ...group, parentId: 'group' }])],
    ['descendant cycle', snapshot([{ ...group, parentId: 'other' }, { ...group, id: 'other', parentId: 'group' }])],
    ['non-group parent', snapshot([{ ...child, parentId: null }, { ...group, parentId: 'child' }])],
    ['unknown record field', snapshot([{ ...group, children: [] }])],
    ['invalid node count', { ...snapshot([group]), rowCount: -1 }],
  ])('rejects %s rather than repairing an incomplete forest', (_reason, value) => {
    expect(() => schemas.parseSystemTree('menus', value)).toThrow(/Invalid|snapshot|parent|cycle|duplicate|count/);
  });
});
