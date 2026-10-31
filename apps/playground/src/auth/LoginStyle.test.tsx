import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, expect, it } from 'vitest';
import { compilePlaygroundStyles, matchingRules, readCompiledRules, type CompiledStyleRule } from '../tests/compiled-styles';
import { renderLoginStyleScene } from '../tests/login-style-scene';

let rules: CompiledStyleRule[];
beforeAll(async () => { rules = readCompiledRules(await compilePlaygroundStyles()); });

// Authentication retains its large-control geometry while consuming the approved design tokens.
// This checks the emitted app CSS and shared consumption, without claiming browser layout.
it.each(['light', 'dark'])('uses the shared large-control skin in both authentication consumers in %s', async mode => {
  const f = await renderLoginStyleScene();
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.density = 'standard';
  try {
    const token = (name: string) => matchingRules(rules, document.documentElement, name).map(rule => rule.style.getPropertyValue(name)).filter(Boolean).at(-1)?.trim();
    expect(token('--control-height')).toBe('32px');
    expect(token('--control-height-lg')).toBe('40px');
    expect(token('--control-font-size-lg')).toBe('16px');
    expect(token('--control-line-height-lg')).toBe('24px');
    expect(token('--control-border')).toBe(mode === 'light' ? '#cdd0d6' : '#4a4a50');
    const login = screen.getByLabelText('账号');
    for (const input of [login, screen.getByLabelText('Other account')]) {
      const border = matchingRules(rules, input, 'border-color');
      expect(border.filter(rule => rule.layer === null)).toHaveLength(0);
      expect(border.some(rule => rule.style.getPropertyValue('border-color') === 'var(--control-border)')).toBe(true);
      expect(matchingRules(rules, input, 'background-color').some(rule => rule.style.getPropertyValue('background-color') === 'var(--control-background)')).toBe(true);
      expect(matchingRules(rules, input, 'height').some(rule => rule.style.getPropertyValue('height') === 'var(--control-height-lg)')).toBe(true);
      expect(matchingRules(rules, input, 'font-size').some(rule => rule.style.getPropertyValue('font-size') === 'var(--control-font-size-lg)')).toBe(true);
    }
    fireEvent.change(login, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(login).toHaveAttribute('aria-invalid', 'true');
    expect(login).toHaveFocus();
    expect(matchingRules(rules, login, 'border-color').some(rule => rule.style.getPropertyValue('border-color') === 'var(--destructive)')).toBe(true);
  } finally {
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.density;
    f.dispose();
  }
});
