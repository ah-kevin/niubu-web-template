import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Pagination } from './Pagination';

const labels = {
  firstPage: 'First',
  lastPage: 'Last',
  previousPage: 'Previous',
  nextPage: 'Next',
  previousPages: 'Earlier',
  nextPages: 'Later',
  pageSize: 'Page size',
  pageNumber: (page: number) => `Page ${page}`,
  page: (page: number, count: number) => `${page} / ${count}`,
  total: (count: number) => `Total ${count}`,
};
function Fixture({ disabled = false, simple = false }: { disabled?: boolean; simple?: boolean }) {
  const [value, setValue] = useState({ pageIndex: 0, pageSize: 10 });
  return (
    <Pagination
      label="Records"
      {...value}
      total={128}
      pageCount={Math.ceil(128 / value.pageSize)}
      disabled={disabled}
      simple={simple}
      labels={labels}
      onPageChange={pageIndex => setValue(v => ({ ...v, pageIndex }))}
      onPageSizeChange={pageSize => setValue({ pageIndex: 0, pageSize })}
    />
  );
}
it('moves by page, window, first/last and typed page while keeping the current page visible', () => {
  render(<Fixture />);
  expect(screen.getByText('Total 128')).toBeVisible();
  expect(screen.getByRole('button', { name: 'First' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(screen.getByRole('button', { name: 'Page 6' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Last' }));
  expect(screen.getByRole('button', { name: 'Page 13' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  const jump = screen.getByRole('spinbutton');
  fireEvent.change(jump, { target: { value: '2' } });
  fireEvent.keyDown(jump, { key: 'Enter' });
  expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  fireEvent.change(jump, { target: { value: '999' } });
  fireEvent.blur(jump);
  expect(jump).toHaveValue(13);
  fireEvent.click(screen.getByRole('button', { name: 'First' }));
  expect(jump).toHaveValue(1);
});
it('changes page size through the controlled owner and resets its page', async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Last' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Page size' }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: '20 条/页' }));
  expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveTextContent('20');
  expect(screen.getByText('1 / 7')).toBeInTheDocument();
});
it('offers a simple pager and disables every interactive control together', () => {
  const view = render(<Fixture simple />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.getByText('1 / 13')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('2 / 13')).toBeVisible();
  view.rerender(<Fixture disabled />);
  for (const button of within(screen.getByRole('navigation')).getAllByRole('button')) expect(button).toBeDisabled();
  expect(screen.getByRole('spinbutton')).toBeDisabled();
  expect(screen.getByRole('combobox')).toBeDisabled();
});
