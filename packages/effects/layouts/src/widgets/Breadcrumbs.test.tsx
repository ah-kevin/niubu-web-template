import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { corePreferenceDefaults, type CorePreferences } from '@niubu/core-preferences';
import * as widgets from './index';
import { renderWidgets } from './widget-test-utils';

const items: readonly widgets.BreadcrumbItem[] = Object.freeze([
  Object.freeze({ id: 'home', labelKey: 'common:save', href: '/start?scopeKind=region&scopeId=north', current: false, home: true, iconToken: 'home' }),
  Object.freeze({ id: 'records', labelKey: 'common:cancel', href: '/records?scopeKind=region&scopeId=north', current: false, iconToken: 'records' }),
  Object.freeze({ id: 'detail', labelKey: 'common:close', href: '/must-not-link', current: true, iconToken: 'detail' }),
]);

it('exports a controlled renderer and keeps current items non-linking', async () => {
  expect(widgets, 'the generic widget must be a real public consumer').toHaveProperty('Breadcrumbs');
  const { Breadcrumbs } = widgets;
  await renderWidgets(<Breadcrumbs items={items} value={{ ...corePreferenceDefaults.breadcrumb, showHome: true, showIcon: true }} renderLink={(item, children) => <a href={item.href}>{children}</a>} renderIcon={token => <span data-testid="crumb-icon">{token}</span>} />);
  const nav = screen.getByRole('navigation');
  expect(within(nav).getByRole('link', { name: 'Save' })).toHaveAttribute('href', '/start?scopeKind=region&scopeId=north');
  expect(within(nav).getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/records?scopeKind=region&scopeId=north');
  expect(within(nav).queryByRole('link', { name: 'Close' })).not.toBeInTheDocument();
  expect(within(nav).getByText('Close')).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getAllByTestId('crumb-icon')).toHaveLength(3);
});

it('applies all five breadcrumb fields without mutating supplied projection or preference values', async () => {
  expect(widgets).toHaveProperty('Breadcrumbs');
  const { Breadcrumbs } = widgets;
  const value = Object.freeze({ enabled: true, hideOnlyOne: false, showHome: true, showIcon: true, style: 'background' as const });
  const scene = (patch: Partial<CorePreferences['breadcrumb']> = {}, input = items) => <Breadcrumbs items={input} value={Object.freeze({ ...value, ...patch })} renderLink={(item, children) => <a href={item.href}>{children}</a>} renderIcon={token => <i data-testid="crumb-icon">{token}</i>} />;
  const view = await renderWidgets(scene());
  expect(screen.getByRole('navigation')).toHaveAttribute('data-breadcrumb-style', 'background');
  expect(screen.getByRole('navigation').querySelector('.breadcrumb-item')).toHaveStyle({ background: 'var(--muted)', padding: '3px 6px', borderRadius: 'var(--radius)' });
  view.rerender(scene({ showHome: false, showIcon: false, style: 'normal' }));
  expect(screen.queryByRole('link', { name: 'Save' })).not.toBeInTheDocument();
  expect(screen.queryAllByTestId('crumb-icon')).toHaveLength(0);
  expect(screen.getByRole('navigation')).toHaveAttribute('data-breadcrumb-style', 'normal');
  expect((screen.getByRole('navigation').querySelector('.breadcrumb-item') as HTMLElement).style.background).toBe('');
  view.rerender(scene({ enabled: false }));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  view.rerender(scene({ hideOnlyOne: true }, items.slice(-1)));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  view.rerender(scene({ hideOnlyOne: false }, items.slice(-1)));
  expect(screen.getByRole('navigation')).toBeVisible();
  view.rerender(scene({ hideOnlyOne: true, showHome: false }, [items[0]!, items[2]!]));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(items[0]!.home).toBe(true);
  expect(value).toEqual({ enabled: true, hideOnlyOne: false, showHome: true, showIcon: true, style: 'background' });
});
