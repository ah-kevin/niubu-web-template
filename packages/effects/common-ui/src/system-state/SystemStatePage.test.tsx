import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SystemStatePage } from './SystemStatePage';
import { StartupError } from './StartupError';

it('renders startup failure outside all providers', () => {
  render(<StartupError heading="Cannot start" description="Reload this page" />);
  expect(screen.getByRole('main')).toHaveTextContent('Cannot start');
  expect(screen.getByRole('heading', { level: 1, name: 'Cannot start' })).toBeVisible();
  expect(screen.getByText('Reload this page')).toBeVisible();
});
it('uses only injected status content, links and actions', () => {
  const retry = vi.fn();
  render(<SystemStatePage heading="Unavailable" description="Choose another page" code="WAIT" footer="Service status"
    actions={[{ id: 'back', label: 'Return', href: '/sample' }, { id: 'retry', label: 'Retry', onClick: retry, variant: 'outline' }]}
    renderLink={({ href, children }) => <a href={href}>{children}</a>} />);
  expect(screen.getByRole('heading', { name: 'Unavailable' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Return' })).toHaveAttribute('href', '/sample');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledOnce();
});
