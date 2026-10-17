import { render, screen } from '@testing-library/react';
import { beforeAll, expect, it } from 'vitest';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { FormsPage } from '../examples/forms/FormsPage';
import { compilePlaygroundStyles, matchingRules, readCompiledRules, type CompiledStyleRule } from '../tests/compiled-styles';

let rules: CompiledStyleRule[];
beforeAll(async () => { rules = readCompiledRules(await compilePlaygroundStyles()); });

it('keeps the real form example title at its fixed size and spacing', () => {
  const view = render(<FormsPage />);
  const heading = view.container.querySelector('.pattern-page > h1')!;
  expect(matchingRules(rules, heading, 'font-size').some(rule => rule.style.getPropertyValue('font-size') === '24px')).toBe(true);
  expect(matchingRules(rules, heading, 'font-weight').some(rule => ['600', 'var(--font-weight-semibold)'].includes(rule.style.getPropertyValue('font-weight')))).toBe(true);
  expect(matchingRules(rules, heading, 'margin-bottom').some(rule => rule.style.getPropertyValue('margin-bottom') === '12px')).toBe(true);
});

it('retains the public CSS contract for bare business breadcrumbs and loading messages', () => {
  render(<><nav aria-label="Business crumbs" className="breadcrumbs"><span><a href="/home">Home</a></span><span>Current</span></nav><p className="page-loading">Loading</p></>);
  const nav = screen.getByRole('navigation', { name: 'Business crumbs' });
  const fallback = (element: Element, property: string) => matchingRules(rules, element, property).filter(rule => (rule.layer === null || rule.layer === 'components') && rule.media.length === 0).at(-1)?.style.getPropertyValue(property);
  expect(fallback(nav, 'display')).toBe('flex');
  expect(fallback(nav, 'align-items')).toBe('center');
  expect(fallback(nav, 'flex-wrap')).toBe('wrap');
  expect(fallback(nav, 'gap')).toBe('10px');
  expect(fallback(nav, 'font-size')).toBe('10px');
  expect(fallback(nav, 'color')).toBe('var(--muted-foreground)');
  expect(fallback(nav.lastElementChild!, 'color')).toBe('var(--foreground)');
  const link = screen.getByRole('link', { name: 'Home' });
  const hover = rules.filter(rule => (rule.layer === null || rule.layer === 'components') && rule.selector.endsWith(':hover') && link.matches(rule.selector.replace(/:hover$/, '')));
  expect(hover.some(rule => rule.style.getPropertyValue('color') === 'var(--primary-text)' && rule.style.getPropertyValue('text-decoration') === 'underline')).toBe(true);
  const loading = screen.getByText('Loading');
  expect(fallback(loading, 'padding')).toBe('60px');
  expect(fallback(loading, 'text-align')).toBe('center');
  expect(fallback(loading, 'font-size')).toBe('13px');
  expect(fallback(loading, 'color')).toBe('var(--muted-foreground)');
});

it.each([undefined, 'selected'])('renders distinct mixed and checked shapes through compiled state styles (name=%s)', name => {
  const view = render(<Checkbox aria-label="Selection" checked="indeterminate" name={name} />);
  const checkbox = screen.getByRole('checkbox', { name: 'Selection' });
  const display = (element: Element) => matchingRules(rules, element, 'display').filter(rule => rule.layer === 'utilities' && rule.media.length === 0).at(-1)?.style.getPropertyValue('display');
  expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
  expect(checkbox).toHaveAttribute('data-state', 'indeterminate');
  const minus = checkbox.querySelector('.lucide-minus');
  expect(minus).not.toBeNull();
  const check = checkbox.querySelector('.lucide-check')!;
  expect(display(minus!)).toBe('block');
  expect(display(check)).toBe('none');
  view.rerender(<Checkbox aria-label="Selection" checked name={name} />);
  expect(checkbox).toHaveAttribute('aria-checked', 'true');
  expect(checkbox).toHaveAttribute('data-state', 'checked');
  expect(display(checkbox.querySelector('.lucide-check')!)).toBe('block');
  expect(display(checkbox.querySelector('.lucide-minus')!)).toBe('none');
});
