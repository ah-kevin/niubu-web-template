import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TablesPage } from './TablesPage';
import { compilePlaygroundStyles, matchingRules, readCompiledRules } from '../../tests/compiled-styles';

it('groups the actual query form actions without changing the public bare-form footer', async () => {
  const rules = readCompiledRules(await compilePlaygroundStyles());
  render(<TablesPage />);
  const footer = screen.getByRole('button', { name: '查询合成数据' }).closest('.pattern-form-actions');
  expect(footer).not.toBeNull();
  const unlayeredJustification = (element: Element) => matchingRules(rules, element, 'justify-content')
    .filter(rule => rule.layer === null && rule.media.length === 0)
    .at(-1)?.style.getPropertyValue('justify-content');
  expect(unlayeredJustification(footer!)).toBe('flex-start');
  const bareFooter = document.createElement('div');
  bareFooter.className = 'pattern-form-actions';
  expect(unlayeredJustification(bareFooter)).toBe('space-between');
});
