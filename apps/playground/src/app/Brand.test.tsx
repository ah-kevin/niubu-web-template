import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PlaygroundBrand } from './Brand';

it('uses the product name and preserves the caller destination', () => {
  render(<PlaygroundBrand href="/home?scopeKind=workspace&scopeId=north" />);
  const link = screen.getByRole('link', { name: 'Template Playground' });
  expect(link).toHaveAttribute('href', '/home?scopeKind=workspace&scopeId=north');
  expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});

it('keeps an accessible name in compact mode and does not invent a link', () => {
  const view = render(<PlaygroundBrand compact />);
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByLabelText('Template Playground')).toHaveAttribute('title', 'Template Playground');
  expect(screen.getByText('Template Playground')).toBeInTheDocument();
  view.rerender(<PlaygroundBrand compact href="/home" />);
  expect(screen.getByRole('link', { name: 'Template Playground' })).toHaveAttribute('href', '/home');
});
