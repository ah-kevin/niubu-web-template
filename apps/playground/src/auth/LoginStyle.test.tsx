import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, expect, it } from 'vitest';
import { compilePlaygroundStyles, matchingRules, readCompiledRules, type CompiledStyleRule } from '../tests/compiled-styles';
import { renderLoginStyleScene } from '../tests/login-style-scene';

let rules: CompiledStyleRule[];
beforeAll(async () => { rules = readCompiledRules(await compilePlaygroundStyles()); });

it.each(['light', 'dark'])('emits the same readable authentication boundaries for login and public controls in %s', async mode => {
  const f = await renderLoginStyleScene();
  document.documentElement.dataset.theme = mode;
  try {
    const login = screen.getByLabelText('账号');
    const other = screen.getByLabelText('Other account');
    for (const input of [login, other]) {
      const border = matchingRules(rules, input, 'border-color');
      expect(border.filter(rule => rule.layer === null)).toHaveLength(0);
      expect(border.some(rule => rule.layer === 'utilities' && rule.style.getPropertyValue('border-color') === 'var(--control-border)')).toBe(true);
      expect(matchingRules(rules, input, 'background-color').some(rule => rule.layer === 'utilities' && rule.style.getPropertyValue('background-color') === 'var(--card)')).toBe(true);
      expect(matchingRules(rules, input, 'height').some(rule => rule.style.getPropertyValue('height') === '44px')).toBe(true);
      expect(matchingRules(rules, input, 'font-size').some(rule => rule.style.getPropertyValue('font-size') === '12px')).toBe(true);
    }
    const themeRules = rules.filter(rule => rule.layer === null && document.documentElement.matches(rule.selector));
    const token = (name: string) => themeRules.map(rule => rule.style.getPropertyValue(name)).filter(Boolean).at(-1);
    expect(token('--control-border')).toBe(mode === 'light' ? '#767680' : '#7f7f88');
    const card = document.createElement('span');
    card.style.color = token('--card') ?? '';
    expect(card.style.color).toBe(mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(28, 30, 35)');
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(login).toHaveAttribute('aria-invalid', 'true');
    expect(matchingRules(rules, login, 'border-color').some(rule => rule.layer === 'utilities' && rule.style.getPropertyValue('border-color') === 'var(--destructive)')).toBe(true);
  } finally { delete document.documentElement.dataset.theme; f.dispose(); }
});
