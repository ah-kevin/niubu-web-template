import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Loading, Progress, Skeleton, Spinner } from './Loading';

it('announces loading once and keeps its spinner decorative', () => {
  render(<Loading label="Loading records" size="lg" />);
  const status = screen.getByRole('status', { name: 'Loading records' });
  expect(status).toHaveAttribute('aria-busy', 'true');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(status.querySelector('[data-size="lg"]')).toHaveAttribute('aria-hidden', 'true');
});
it('supports a named standalone spinner and decorative skeleton', () => {
  render(
    <>
      <Spinner label="Saving" size="sm" />
      <Skeleton data-testid="skeleton" />
    </>,
  );
  expect(screen.getByRole('status', { name: 'Saving' })).toHaveAttribute('data-size', 'sm');
  expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
});
it('reports a bounded percentage and omits progress for indeterminate work', () => {
  const view = render(<Progress label="Import" value={30} />);
  const progress = screen.getByRole('progressbar', { name: 'Import' });
  expect(progress).toHaveAttribute('aria-valuenow', '30');
  expect(progress.firstElementChild).toHaveStyle({ width: '30%' });
  view.rerender(<Progress label="Import" value={150} />);
  expect(progress).toHaveAttribute('aria-valuenow', '100');
  view.rerender(<Progress label="Import" />);
  expect(progress).not.toHaveAttribute('aria-valuenow');
  expect(progress).toHaveAttribute('data-state', 'indeterminate');
});
