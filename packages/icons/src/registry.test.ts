import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import * as icons from './index';

const FileIcon: icons.IconComponent = props => createElement('svg', props);
const Fallback: icons.IconComponent = props => createElement('svg', { ...props, 'data-icon': 'fallback' });

it('accepts the existing named Lucide and local SVG components without adapters', () => {
  const registry = icons.createIconRegistry([
    { name: 'file', icon: icons.FileQuestion }, { name: 'ep:fold', icon: icons.MenuFold },
  ]);
  expect(registry.resolve('file')).toBe(icons.FileQuestion);
  expect(registry.resolve('ep:fold')).toBe(icons.MenuFold);
});

it('resolves explicitly registered components without loading any library namespace', () => {
  const entries = [{ name: 'file', icon: FileIcon }];
  const registry = icons.createIconRegistry(entries);
  entries[0]!.name = 'changed';
  expect(registry.resolve('file')).toBe(FileIcon);
  expect(registry.resolve('missing')).toBeUndefined();
});
it('reports unknown tokens and returns the explicitly supplied fallback', () => {
  const onUnknown = vi.fn();
  const registry = icons.createIconRegistry([{ name: 'file', icon: FileIcon }], { fallback: Fallback, onUnknown });
  expect(registry.resolve('file')).toBe(FileIcon);
  expect(onUnknown).not.toHaveBeenCalled();
  expect(registry.resolve('unknown')).toBe(Fallback);
  expect(onUnknown).toHaveBeenCalledExactlyOnceWith('unknown');
});
it('rejects duplicate entries instead of replacing the first icon', () => {
  expect(() => icons.createIconRegistry([{ name: 'file', icon: FileIcon }, { name: 'file', icon: Fallback }]))
    .toThrow(/duplicate.*file/i);
});
it.each(['', ' ', ' bad', 'bad ', 'bad name', 'bad\nname', '../file'])('rejects invalid names %j', name => {
  expect(() => icons.createIconRegistry([{ name, icon: FileIcon }])).toThrow(/invalid.*name/i);
});
it('does not confuse prototype properties with registered icons', () => {
  const registry = icons.createIconRegistry([{ name: '__proto__', icon: FileIcon }, { name: 'ep:fold', icon: Fallback }]);
  expect(registry.resolve('__proto__')).toBe(FileIcon);
  expect(registry.resolve('ep:fold')).toBe(Fallback);
  expect(registry.resolve('constructor')).toBeUndefined();
});
