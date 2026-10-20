import { expect, it } from 'vitest';
import { compilePlaygroundStyles, readCompiledRules } from '../tests/compiled-styles';

it('ships the tab shoulders and glyph sizes through the real app stylesheet', async () => {
  const rules = readCompiledRules(await compilePlaygroundStyles());
  const style = (selector: string, property: string) => rules.filter(rule => rule.selector.split(',').map(value => value.trim()).includes(selector)).map(rule => rule.style.getPropertyValue(property)).filter(Boolean).at(-1);
  expect(style('.page-tab-shape', 'position')).toBe('absolute');
  expect(style('.page-tab-shape', 'pointer-events')).toBe('none');
  expect(style('.page-tab-shape svg', 'position')).toBe('absolute');
  expect(style('.page-tab-shape svg', 'fill')).toBe('var(--tab-fill)');
  expect(style('.page-tab-close svg', 'width')).toBe('13px');
  expect(style('.page-tab-pin svg', 'width')).toBe('12px');
  expect(style('.page-tab-tool svg', 'width')).toBe('15px');
});

it('keeps constrained header breadcrumbs on one line with shrinkable labels', async () => {
  const rules = readCompiledRules(await compilePlaygroundStyles());
  const header = rules.find(rule => rule.selector === '.foundation-layout .context-actions > .breadcrumbs' && rule.style.getPropertyValue('flex-wrap'));
  expect(header?.style.getPropertyValue('flex-wrap')).toBe('nowrap');
  expect(header?.style.getPropertyValue('overflow')).toBe('hidden');
  const item = rules.find(rule => rule.selector === '.foundation-layout .context-actions > .breadcrumbs > .breadcrumb-item');
  expect(item?.style.getPropertyValue('flex-shrink')).toBe('1');
});
