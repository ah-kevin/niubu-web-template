import { fireEvent, screen } from '@testing-library/react';
import { render } from './fixtures';
import { expect, it, vi } from 'vitest';
import { ReadState } from '@niubu/common-ui/read-state';

  it('source-empty ReadState never offers a reset and rejects an unsafe return', () => {
    render(<ReadState status="source-empty" onReset={vi.fn()} fallback="https://untrusted.example" />);
    expect(screen.getByRole('heading', { name: '暂无来源记录' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '清除筛选' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作空间' })).toHaveAttribute('href', '/overview');
  });

it('keeps default actions for undefined, replaces them for explicit node and removes them for null',()=>{
 const retry=vi.fn();const view=render(<ReadState status="error" onRetry={retry}/>);expect(screen.getByRole('button',{name:'重新读取'})).toBeVisible();expect(screen.getByRole('link',{name:'返回工作空间'})).toBeVisible();
 view.rerender(<ReadState status="error" onRetry={retry} actions={null}/>);expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(screen.queryByRole('link')).not.toBeInTheDocument();view.rerender(<ReadState status="error" onRetry={retry} actions={<button onClick={retry}>只重试</button>}/>);expect(screen.getAllByRole('button')).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'只重试'}));expect(retry).toHaveBeenCalledOnce();expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
