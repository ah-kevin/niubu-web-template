import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Button } from '../../packages/@core/ui-kit/shadcn-ui/src/button';

it('keeps its content and indicator space while blocking duplicate submissions during loading', () => {
  const onClick = vi.fn();
  const view = render(<Button loading={false} onClick={onClick}>Save</Button>);
  const button = screen.getByRole('button', { name: 'Save' });
  const indicator = button.querySelector('[aria-hidden="true"]');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  view.rerender(<Button loading onClick={onClick}>Save</Button>);
  expect(screen.getByRole('button', { name: 'Save' })).toBe(button);
  expect(button.querySelector('[aria-hidden="true"]')).toBe(indicator);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  view.rerender(<Button loading={false} onClick={onClick}>Save</Button>);
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(2);
});

it('preserves asChild content and link semantics when reserving a loading indicator', () => {
  const activate = vi.fn();
  const view = render(<Button asChild loading={false}><a href="#details">Details</a></Button>);
  const link = screen.getByRole('link', { name: 'Details' });
  expect(link).toHaveAttribute('href', '#details');
  view.rerender(<Button asChild loading><a href="#details" onClick={activate}>Details</a></Button>);
  expect(screen.getByRole('link', { name: 'Details' })).toBe(link);
  expect(link).toHaveAttribute('aria-disabled', 'true');
  expect(fireEvent.click(link)).toBe(false);
  expect(activate).not.toHaveBeenCalled();
});
