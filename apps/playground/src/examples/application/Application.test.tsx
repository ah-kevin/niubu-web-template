import { selectOption } from '../../tests/select-option';
import { StrictMode } from 'react';
import { CapacityExample } from './TabsPage';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../../locales';
import { AccessPage } from './AccessPage';
import { NavigationPage } from './NavigationPage';
import { RequestFeaturesPage } from './RequestFeaturesPage';

async function mount(node: React.ReactNode) {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  await i18n.changeLocale(i18n.getSnapshot().preferredLocale, i18n.requiredNamespaces);
  return render(<I18nProvider instance={i18n}>{node}</I18nProvider>);
}
describe('confirmed application examples', () => {
  it('switches synthetic roles/codes/scope through real authorization projection without granting another scope', async () => {
    await mount(<AccessPage />);
    expect(screen.getByText('admin 页面：允许')).toBeVisible();
    expect(screen.queryByRole('button', { name: '删除示例' })).not.toBeInTheDocument();
    await selectOption(screen.getByLabelText('合成角色'), 'super');
    expect(screen.getByText('super 页面：允许')).toBeVisible();
    expect(screen.getByText('admin 页面：拒绝')).toBeVisible();
    fireEvent.click(screen.getByLabelText('授予写权限'));
    expect(screen.getByRole('button', { name: '删除示例' })).toBeEnabled();
    await selectOption(screen.getByLabelText('合成工作空间'), 'other');
    expect(screen.getByText('当前 scope 不在授权列表')).toBeVisible();
    expect(screen.queryByRole('button', { name: '删除示例' })).not.toBeInTheDocument();
  });
  it('renders nested navigation, badge, hidden direct access, safe external links and projected breadcrumb', async () => {
    await mount(<NavigationPage />);
    const nav = screen.getByRole('navigation', { name: '合成菜单' });
    expect(within(nav).getByRole('link', { name: /Menu 1/ })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: '隐藏详情' })).not.toBeInTheDocument();
    const external = within(nav).getByRole('link', { name: 'Vite' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(screen.getByRole('button', { name: '打开隐藏详情' }));
    expect(screen.getByText('隐藏详情可直接访问')).toBeVisible();
    expect(screen.getByRole('navigation', { name: '面包屑' })).toHaveTextContent('Menu 1');
    fireEvent.click(screen.getByRole('button', { name: '撤销嵌入权限' }));
    expect(screen.queryByTitle('本地嵌入示例')).not.toBeInTheDocument();
  });
  it('uses repeated query keys and download metadata through the request client, strict expiry and isolated recovery', async () => {
    await mount(<RequestFeaturesPage />);
    await screen.findByText('合成会话 ready');
    fireEvent.click(screen.getByRole('button', { name: '发送重复参数' }));
    expect(await screen.findByText('query=one&query=two')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '读取下载元数据' }));
    expect(await screen.findByText(/sample.txt · text\/plain/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '普通 401' }));
    expect(screen.getByText('不触发过期流程')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '模拟续期失败' }));
    expect(await screen.findByText('会话已过期，等待恢复')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '恢复合成会话' }));
    await waitFor(() => expect(screen.getByText('合成会话 ready')).toBeVisible());
  });
});

it('keeps the isolated request and capacity owners usable across StrictMode replay', async () => {
  const i18n = createPlaygroundI18n('zh-CN',{lang:'zh-CN',dir:'ltr'});
  await i18n.changeLocale(i18n.getSnapshot().preferredLocale, i18n.requiredNamespaces);
  const scene = render(<StrictMode><I18nProvider instance={i18n}><RequestFeaturesPage /><CapacityExample /></I18nProvider></StrictMode>);
  await screen.findByText('合成会话 ready');
  fireEvent.click(screen.getByRole('button', {name:'发送重复参数'}));
  expect(await screen.findByText('query=one&query=two')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'打开下一个合成标签'}));
  expect(screen.getByLabelText('容量结果')).toHaveTextContent('home, 1');
  scene.unmount();
});


it('keeps the embedded menu selection, breadcrumb and visible content aligned through revocation', async () => {
  await mount(<NavigationPage />);
  const nav = screen.getByRole('navigation', { name: '合成菜单' });
  fireEvent.click(within(nav).getByRole('link', { name: '本地嵌入示例' }));
  expect(within(nav).getByRole('link', { name: '本地嵌入示例' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('navigation', { name: '面包屑' })).toHaveTextContent('本地嵌入示例');
  expect(screen.getByRole('status')).toHaveTextContent('本地嵌入示例');
  fireEvent.click(screen.getByRole('button', { name: '撤销嵌入权限' }));
  expect(screen.queryByTitle('本地嵌入示例')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Menu 1');
});

it('keeps a file-save failure in the download scene and preserves the session result', async () => {
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw Error('unavailable'); });
  try {
    await mount(<RequestFeaturesPage />);
    await screen.findByText('合成会话 ready');
    fireEvent.click(screen.getByRole('button', { name: '普通 401' }));
    fireEvent.click(screen.getByRole('button', { name: '读取下载元数据' }));
    fireEvent.click(await screen.findByRole('button', { name: '保存合成文件' }));
    const download = within(screen.getByRole('region', { name: '统一 Blob 下载' }));
    expect(download.getByRole('alert')).toHaveTextContent('当前环境无法保存文件');
    expect(screen.getByText('不触发过期流程')).toBeVisible();
  } finally {
    createUrl.mockRestore();
  }
});
