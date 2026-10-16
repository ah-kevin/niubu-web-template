import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Navigation, TreeNavigation, type LinkProps, type NavigationItem } from './index';

// The app binding consumes external; it must never become a literal DOM attribute.
const renderLink = ({ external, ...props }: LinkProps) => <a {...props} data-binding-external={external} />;

describe.each(['flat', 'tree'] as const)('%s navigation metadata', variant => {
  function renderItem(metadata: Partial<NavigationItem> = {}) {
    const item: NavigationItem = {
      id: 'docs', href: '/docs', label: 'Documentation', group: 'Resources', active: false, ...metadata,
    };
    return render(variant === 'flat'
      ? <Navigation items={[item]} label="Resources" renderLink={renderLink} />
      : <TreeNavigation nodes={[{ kind: 'leaf', ...item }]} label="Resources" expandedIds={[]} onExpand={() => {}} renderLink={renderLink} />);
  }

  it.each(['New', 0])('renders badge %s inside the link label and forwards external new-window fields', badge => {
    renderItem({ href: 'https://docs.example.invalid', badge, target: '_blank', rel: 'noopener noreferrer', external: true });
    const link = screen.getByRole('link', { name: `Documentation ${badge}` });
    expect(link).toHaveAttribute('href', 'https://docs.example.invalid');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('data-binding-external', 'true');
    expect(link).not.toHaveAttribute('external');
    expect(link).not.toHaveAttribute('badge');
    const badgeElement = within(link).getByText(String(badge));
    expect(badgeElement).toHaveClass('nav-badge');
    expect(badgeElement.parentElement).toHaveTextContent(`Documentation ${badge}`);
  });

  it.each([undefined, 'opener' as LinkProps['rel']])('enforces safe new-window rel when the supplied rel is %s', rel => {
    // The cast models an untyped caller supplying a weaker runtime value.
    renderItem({ target: '_blank', rel });
    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps an explicit false external binding and rel without forcing a new window', () => {
    renderItem({ external: false, rel: 'noopener noreferrer' });
    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link).toHaveAttribute('data-binding-external', 'false');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('external');
  });

  it('preserves the default anchor fields and label without metadata', () => {
    const { container } = renderItem({ active: true });
    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link).toHaveAttribute('href', '/docs');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('nav-link', 'active');
    for (const attribute of ['target', 'rel', 'external', 'badge', 'data-binding-external'])
      expect(link).not.toHaveAttribute(attribute);
    expect(container.querySelector('.nav-badge')).toBeNull();
  });
});

it('renders badges within branch and group labels without changing their disclosure semantics', () => {
  render(<TreeNavigation nodes={[{
    kind: 'branch', id: 'group', presentation: 'group', label: 'Resources', badge: 'New', children: [{
      kind: 'branch', id: 'branch', label: 'Projects', badge: 0, children: [],
    }],
  }]} label="Tree" expandedIds={[]} onExpand={() => {}} renderLink={renderLink} />);
  const branch = screen.getByRole('button', { name: 'Projects 0' });
  expect(branch).toHaveAttribute('aria-expanded', 'false');
  expect(within(branch).getByText('0')).toHaveClass('nav-badge');
  expect(within(branch).getByText('0').parentElement).toHaveClass('navigation-label');
  const groupBadge = screen.getByText('New');
  expect(groupBadge).toHaveClass('nav-badge');
  expect(groupBadge.parentElement).toHaveClass('navigation-group-label');
  expect(screen.queryByRole('button', { name: 'Resources New' })).toBeNull();
});
