import { screen } from '@testing-library/react';
import { render } from './fixtures';
import { expect, it, vi } from 'vitest';
import { ReadState } from '@niubu/common-ui/read-state';

  it('source-empty ReadState never offers a reset and rejects an unsafe return', () => {
    render(<ReadState status="source-empty" onReset={vi.fn()} fallback="https://untrusted.example" />);
    expect(screen.getByRole('heading', { name: '暂无来源记录' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '清除筛选' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作空间' })).toHaveAttribute('href', '/overview');
  });
