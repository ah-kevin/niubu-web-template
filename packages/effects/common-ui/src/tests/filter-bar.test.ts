import { useState, createElement } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render } from './fixtures';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parseQuery, writeQuery } from '@niubu/core-shared';
import { FilterBar } from '@niubu/common-ui/filter-bar';

describe('FilterBar active edits through actual URL serialization', () => {
  function UrlFilter({ url }: { url?: string }) {
    const [params, setParams] = useState(() => new URLSearchParams(url));
    const query = parseQuery(params, ['name']);
    return createElement('div', null,
      createElement(FilterBar, { query, onQueryChange: (next) => setParams(writeQuery(next)) }),
      createElement('output', { 'aria-label': '已规范化搜索' }, query.q),
      createElement('button', { onClick: () => setParams(new URLSearchParams('q=external+value&page=2')) }, '外部 URL 变化'),
      createElement('button', { onClick: () => setParams(new URLSearchParams()) }, '外部 URL 重置'),
    );
  }

  it('keeps each inter-word space while normalizing the URL after every character', async () => {
    const user = userEvent.setup();
    render(createElement(UrlFilter));
    const input = screen.getByRole('searchbox', { name: '搜索记录' });
    for (const character of 'order 01') {
      await user.type(input, character);
    }
    expect(input).toHaveValue('order 01');
    expect(screen.getByLabelText('已规范化搜索')).toHaveTextContent('order 01');
    await user.type(input, ' ');
    expect(input).toHaveValue('order 01 ');
    expect(screen.getByLabelText('已规范化搜索').textContent).toBe('order 01');
    await user.type(input, 'active');
    expect(input).toHaveValue('order 01 active');
  });

  it('applies external URL changes and resets and starts a reopened edit from the committed URL', async () => {
    const user = userEvent.setup();
    const view = render(createElement(UrlFilter, { url: 'q=initial+query' }));
    const input = screen.getByRole('searchbox', { name: '搜索记录' });
    expect(input).toHaveValue('initial query');
    await user.click(screen.getByRole('button', { name: '外部 URL 变化' }));
    await waitFor(() => expect(input).toHaveValue('external value'));
    await user.type(input, ' ');
    expect(input).toHaveValue('external value ');
    await user.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(input).toHaveValue('');
    await user.type(input, 'new query');
    await user.click(screen.getByRole('button', { name: '外部 URL 重置' }));
    await waitFor(() => expect(input).toHaveValue(''));
    view.unmount();
    render(createElement(UrlFilter, { url: 'q=reopened+query' }));
    expect(screen.getByRole('searchbox', { name: '搜索记录' })).toHaveValue('reopened query');
  });
});
