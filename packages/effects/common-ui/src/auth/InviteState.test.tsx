import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { InviteState } from './InviteState';
it('presents supplied invitation state without interpreting tokens', () => {
  render(<InviteState heading="Link unavailable" description="Request a new link" eyebrow="Invitation"
    notice="Example state" link={{ href: '/entry', label: 'Return' }}
    renderLink={({ href, children, className }) => <a href={href} className={className}>{children}</a>} />);
  expect(screen.getByRole('heading', { name: 'Link unavailable' })).toBeVisible();
  expect(screen.getByText('Example state')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Return' })).toHaveAttribute('href', '/entry');
});
