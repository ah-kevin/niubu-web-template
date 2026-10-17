import { screen } from '@testing-library/react';
import { beforeAll, expect, it } from 'vitest';
import { compilePlaygroundStyles, matchingRules, readCompiledRules, type CompiledStyleRule } from '../tests/compiled-styles';
import { renderLoginStyleScene } from '../tests/login-style-scene';

let rules: CompiledStyleRule[];
beforeAll(async () => { rules = readCompiledRules(await compilePlaygroundStyles()); });

it('scopes built login sizing to the real login composition while public authentication keeps its defaults', async () => {
  const f = await renderLoginStyleScene();
  try {
    const main = screen.getByRole('main');
    const login = main.querySelector('.template-auth')!;
    const heading = screen.getByRole('heading', { name: '欢迎回来' });
    const other = screen.getByRole('heading', { name: 'Other' });
    expect(matchingRules(rules, login, 'max-width').some(rule => rule.style.getPropertyValue('max-width') === '380px')).toBe(true);
    const desktopTitle = matchingRules(rules, heading, 'font-size').filter(rule => rule.media.length === 0);
    expect(desktopTitle.some(rule => rule.layer === 'utilities' && rule.style.getPropertyValue('font-size') === '30px')).toBe(true);
    expect(desktopTitle.filter(rule => rule.layer === null)).toHaveLength(0);
    expect(matchingRules(rules, other, 'font-size').some(rule => rule.style.getPropertyValue('font-size') === '30px')).toBe(false);
    expect(matchingRules(rules, other, 'font-size').some(rule => rule.style.getPropertyValue('font-size') === '28px')).toBe(true);
    expect(matchingRules(rules, main.querySelector('.auth-card')!, 'max-width').some(rule => rule.style.getPropertyValue('max-width') === '370px')).toBe(true);
    expect(matchingRules(rules, heading, 'font-size').some(rule => rule.media.some(media => media.includes('800px')) && rule.style.getPropertyValue('font-size') === '28px')).toBe(true);
    expect(f.view.container.querySelector('.template-login-art')).toHaveAttribute('aria-hidden', 'true');
  } finally { f.dispose(); }
});
