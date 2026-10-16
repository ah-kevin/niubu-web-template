import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Navigation } from './index';
it('uses only projected items and forwards navigation without selecting app routes', () => {
  const navigate = vi.fn();
  render(
    <Navigation
      items={[{ id: 'x', href: '/foreign', label: 'Projected', group: 'Group', active: true }]}
      label="Menu input"
      renderLink={p => (
        <a
          {...p}
          onClick={event => {
            event.preventDefault();
            p.onClick?.();
          }}
        />
      )}
      onNavigate={navigate}
    />,
  );
  const link = screen.getByRole('link', { name: 'Projected' });
  expect(link).toHaveAttribute('href', '/foreign');
  expect(link).toHaveAttribute('aria-current', 'page');
  fireEvent.click(link);
  expect(navigate).toHaveBeenCalledOnce();
});
