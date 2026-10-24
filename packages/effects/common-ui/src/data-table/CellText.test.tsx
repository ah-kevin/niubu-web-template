import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CellText } from './CellText';
it.each([null, undefined, ''])('renders absent primitive %s with the provided empty copy', value => {render(<CellText value={value} emptyText="无数据" />);expect(screen.getByText('无数据')).toBeVisible();});
it.each([0, false])('preserves the real primitive %s', value => {render(<CellText value={value} />);expect(screen.getByText(String(value))).toBeVisible();});
it('retains complete text and a separate full detail while truncating the visual cell', () => {render(<CellText value="A long label" detail="Complete human-readable detail" />);const cell=screen.getByText('A long label');expect(cell).toHaveAttribute('title','Complete human-readable detail');expect(cell).toHaveClass('truncate');});
