import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CollectionCell } from './CollectionCell';
it.each([null, undefined, []])('renders an empty collection without an object dump', items => {render(<CollectionCell items={items} describeItem={String} />);expect(screen.getByText('—')).toBeVisible();});
it('uses explicit object descriptions and keeps every full value available', () => {const items=[{label:'North',extra:42},{label:'South',extra:13}];render(<CollectionCell items={items} describeItem={item=>`${item.label}: ${item.extra}`} />);expect(screen.getByText('2 项')).toHaveAttribute('title','North: 42\nSouth: 13');});
it('lets the caller own summary and empty presentation', () => {const result=render(<CollectionCell items={['a','b']} describeItem={item=>item.toUpperCase()} formatSummary={count=>`${count} chosen`} />);expect(screen.getByText('2 chosen')).toHaveAttribute('title','A\nB');result.rerender(<CollectionCell items={[]} describeItem={String} emptyText="Nothing selected" />);expect(screen.getByText('Nothing selected')).toBeVisible();});
