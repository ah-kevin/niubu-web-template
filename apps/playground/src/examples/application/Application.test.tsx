import { StrictMode } from 'react';
import { CapacityExample } from './TabsPage';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../../locales';
import { AccessPage } from './AccessPage';
import { NavigationPage } from './NavigationPage';
import { RequestFeaturesPage } from './RequestFeaturesPage';

function mount(node: React.ReactNode) {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  return render(<I18nProvider instance={i18n}>{node}</I18nProvider>);
}
describe('confirmed application examples', () => {
  it('switches synthetic roles/codes/scope through real authorization projection without granting another scope', () => {
    mount(<AccessPage />);
    expect(screen.getByText('admin 页面：允许')).toBeVisible();
    expect(screen.queryByRole('button', { name: '删除示例' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('合成角色'), { target: { value: 'super' } });
    expect(screen.getByText('super 页面：允许')).toBeVisible();
    expect(screen.getByText('admin 页面：拒绝')).toBeVisible();
    fireEvent.click(screen.getByLabelText('授予写权限'));
    expect(screen.getByRole('button', { name: '删除示例' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('合成工作空间'), { target: { value: 'other' } });
    expect(screen.getByText('当前 scope 不在授权列表')).toBeVisible();
    expect(screen.queryByRole('button', { name: '删除示例' })).not.toBeInTheDocument();
  });
  it('renders nested navigation, badge, hidden direct access, safe external links and projected breadcrumb', () => {
    mount(<NavigationPage />);
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
    mount(<RequestFeaturesPage />);
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
  const scene = render(<StrictMode><I18nProvider instance={i18n}><RequestFeaturesPage /><CapacityExample /></I18nProvider></StrictMode>);
  await screen.findByText('合成会话 ready');
  fireEvent.click(screen.getByRole('button', {name:'发送重复参数'}));
  expect(await screen.findByText('query=one&query=two')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'打开下一个合成标签'}));
  expect(screen.getByLabelText('容量结果')).toHaveTextContent('home, 1');
  scene.unmount();
});
