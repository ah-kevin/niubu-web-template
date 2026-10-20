import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@niubu/locales/react';
import { CommandSearch } from '@niubu/layouts/widgets';
import { createStarterI18n } from '../locales';
import { compileStarterStyles, matchingRules, readCompiledRules } from '../tests/compiled-styles';

it('ships the tab shoulders and glyph sizes through the real app stylesheet', async () => {
  const rules = readCompiledRules(await compileStarterStyles());
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
  const rules = readCompiledRules(await compileStarterStyles());
  const header = rules.find(rule => rule.selector === '.foundation-layout .context-actions > .breadcrumbs' && rule.style.getPropertyValue('flex-wrap'));
  expect(header?.style.getPropertyValue('flex-wrap')).toBe('nowrap');
  expect(header?.style.getPropertyValue('overflow')).toBe('hidden');
  const item = rules.find(rule => rule.selector === '.foundation-layout .context-actions > .breadcrumbs > .breadcrumb-item');
  expect(item?.style.getPropertyValue('flex-shrink')).toBe('1');
});

it('keeps the search border on the standard Input instead of a second field frame', async () => {
  const rules = readCompiledRules(await compileStarterStyles());
  const i18n = createStarterI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  await i18n.changeLocale('zh-CN', i18n.requiredNamespaces);
  const view = render(<I18nProvider instance={i18n}><CommandSearch sessionKey="style-fixture" locale="zh-CN" pages={[]} renderLink={props => <a {...props} />} /></I18nProvider>);
  try {
    fireEvent.click(screen.getByRole('button', { name: /搜索页面/ }));
    const input = await screen.findByRole('searchbox');
    expect(input).toHaveFocus();
    const frame = input.closest('.command-input')!;
    const border = (element: Element) => matchingRules(rules, element, 'border-width').at(-1)?.style.getPropertyValue('border-width') ?? '0px';
    expect(border(input)).toBe('1px');
    expect(border(frame)).toBe('0px');
  } finally { view.unmount(); i18n.dispose(); }
});
