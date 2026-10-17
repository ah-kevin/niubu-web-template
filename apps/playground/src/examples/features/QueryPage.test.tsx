import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryPage } from './QueryPage';
import * as fixtureModule from './query-fixture';

afterEach(() => vi.restoreAllMocks());
const area = (name: string) => within(screen.getByRole('region', { name }));

it('uses real paginated queries, retains the previous page while pending and changes scope safely', async () => {
  render(<QueryPage />);
  const page = area('分页查询');
  await page.findByText('synthetic-reader / north / 0 · 第 1 页 · 条目 1');
  fireEvent.click(page.getByRole('button', { name: '下一页' }));
  expect(page.getByText('保留上一页数据')).toBeInTheDocument();
  expect(page.getByText('synthetic-reader / north / 0 · 第 1 页 · 条目 1')).toBeInTheDocument();
  await page.findByText('synthetic-reader / north / 0 · 第 2 页 · 条目 3');
  fireEvent.click(page.getByRole('button', { name: '下一页' }));
  fireEvent.change(screen.getByRole('combobox', { name: '合成 scope' }), { target: { value: 'south' } });
  expect(area('分页查询').queryAllByText(/north.*条目/)).toHaveLength(0);
  await area('分页查询').findByText('synthetic-reader / south / 0 · 第 1 页 · 条目 1');
});

it('retries only the explicit safe GET scenario and surfaces thrown permanent failures', async () => {
  render(<QueryPage />);
  const retry = area('安全 GET 重试');
  fireEvent.click(retry.getByRole('button', { name: '重试一次后成功' }));
  await retry.findByText('合成 GET 成功；尝试：2');
  fireEvent.click(retry.getByRole('button', { name: '持续失败' }));
  expect(await retry.findByRole('alert')).toHaveTextContent('合成 GET 持续失败；尝试：2');
});

it('deduplicates concurrent fetchQuery calls, reuses cache and includes synthetic identity, scope and generation', async () => {
  const fetchQuery = vi.spyOn(QueryClient.prototype, 'fetchQuery');
  render(<QueryPage />);
  const cache = () => area('并发与缓存');
  const read = () => fireEvent.click(cache().getByRole('button', { name: '并发读取同一键' }));
  read();
  await cache().findByText('底层 GET 次数：1；两次结果相同：是');
  read();
  await waitFor(() => expect(fetchQuery).toHaveBeenCalledTimes(4));
  expect(cache().getByText('底层 GET 次数：1；两次结果相同：是')).toBeInTheDocument();
  expect(fetchQuery.mock.calls[0]?.[0].queryKey).toEqual(['playground-features', 'synthetic-reader', 'north', 0, 'concurrent']);
  fireEvent.click(screen.getByRole('button', { name: '更新合成 generation' }));
  read();
  await cache().findByText('底层 GET 次数：1；两次结果相同：是');
  expect(fetchQuery.mock.calls.at(-1)?.[0].queryKey).toEqual(['playground-features', 'synthetic-reader', 'north', 1, 'concurrent']);
  fireEvent.change(screen.getByRole('combobox', { name: '合成 identity' }), { target: { value: 'synthetic-other' } });
  read();
  await cache().findByText('底层 GET 次数：1；两次结果相同：是');
  expect(fetchQuery.mock.calls.at(-1)?.[0].queryKey).toEqual(['playground-features', 'synthetic-other', 'north', 1, 'concurrent']);
});

it('loads real infinite-query pages until exhausted', async () => {
  render(<QueryPage />);
  const infinite = area('加载更多');
  await infinite.findByText('synthetic-reader / north / 0 · 更多条目 1');
  fireEvent.click(infinite.getByRole('button', { name: '加载更多' }));
  await infinite.findByText('synthetic-reader / north / 0 · 更多条目 3');
  fireEvent.click(infinite.getByRole('button', { name: '加载更多' }));
  await infinite.findByText('synthetic-reader / north / 0 · 更多条目 5');
  expect(infinite.getAllByRole('listitem')).toHaveLength(6);
  expect(infinite.getByRole('button', { name: '没有更多数据' })).toBeDisabled();
});

it('cancels and clears each owned client on strict replay and unmount, without clearing the ambient client', async () => {
  const clear = vi.spyOn(QueryClient.prototype, 'clear');
  const cancel = vi.spyOn(QueryClient.prototype, 'cancelQueries');
  const original = fixtureModule.createQueryFixture;
  const fixtures: fixtureModule.QueryFixture[] = [];
  vi.spyOn(fixtureModule, 'createQueryFixture').mockImplementation(() => {
    const fixture = original();
    vi.spyOn(fixture, 'get'); fixtures.push(fixture);
    return fixture;
  });
  const ambient = new QueryClient();
  ambient.setQueryData(['host-cache'], 'preserve me');
  const view = render(<StrictMode><QueryClientProvider client={ambient}><QueryPage /></QueryClientProvider></StrictMode>);
  await area('分页查询').findByText('synthetic-reader / north / 0 · 第 1 页 · 条目 1');
  const owner = clear.mock.contexts[0];
  expect(owner).toBeInstanceOf(QueryClient);
  fireEvent.click(area('分页查询').getByRole('button', { name: '下一页' }));
  const fixture = fixtures.find(value => vi.mocked(value.get).mock.calls.length > 0)!;
  const pendingSignal = vi.mocked(fixture.get).mock.calls.at(-1)![1];
  expect(pendingSignal.aborted).toBe(false);
  view.unmount();
  expect(pendingSignal.aborted).toBe(true);
  expect(ambient.getQueryData(['host-cache'])).toBe('preserve me');
  expect(clear.mock.contexts).not.toContain(ambient);
  expect(cancel).toHaveBeenCalled();
  expect(clear.mock.contexts.at(-1)).toBe(owner);
  if (!(owner instanceof QueryClient)) throw Error('Expected an owned QueryClient');
  expect(owner.getQueryCache().getAll()).toHaveLength(0);
  ambient.clear();
});

it.each([['合成 scope','south','north'],['合成 identity','synthetic-other','synthetic-reader']])('restarts the once-failing retry fixture when returning to %s',async(label,away,back)=>{
 render(<QueryPage />);
 const retry=()=>area('安全 GET 重试');
 fireEvent.click(retry().getByRole('button',{name:'重试一次后成功'}));
 await retry().findByText('合成 GET 成功；尝试：2');
 fireEvent.change(screen.getByRole('combobox',{name:label}),{target:{value:away}});
 fireEvent.change(screen.getByRole('combobox',{name:label}),{target:{value:back}});
 fireEvent.click(retry().getByRole('button',{name:'重试一次后成功'}));
 await retry().findByText('合成 GET 成功；尝试：2');
});
