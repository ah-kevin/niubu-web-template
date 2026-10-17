import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { mountPlayground } from './playground-fixture';
const fixtures: Awaited<ReturnType<typeof mountPlayground>>[] = [];
afterEach(async () => { for (const f of fixtures.splice(0)) await f.dispose(); });
it('renders login independently of workspace navigation and shell', async () => {
  const f = await mountPlayground({ entry: '/login', startup: { authStorage: { getItem: () => null, setItem() {}, removeItem() {} } } });fixtures.push(f);
  expect(await screen.findByRole('textbox', { name: '账号' })).toBeVisible();
  expect(screen.queryByRole('navigation', { name: '业务导航' })).not.toBeInTheDocument();
  expect(f.root.querySelector('.business-shell')).toBeNull();
  expect(screen.getAllByRole('main')).toHaveLength(1);
});
it('uses brand, breadcrumbs and dedicated tabs slot for the signed-in workspace', async () => {
  const f = await mountPlayground({ entry: '/system/users?scopeKind=workspace&scopeId=north' });fixtures.push(f);
  expect(await screen.findByRole('heading', { name: '用户管理' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Template Playground' })).toHaveAttribute('href', '/home?scopeKind=workspace&scopeId=north');
  const crumbs = screen.getByRole('navigation', { name: '面包屑' });
  expect(crumbs).toHaveTextContent('用户管理');expect(crumbs.closest('header')).not.toBeNull();
  const slot = f.root.querySelector<HTMLElement>('[data-slot="page-tabs"]');expect(slot).not.toBeNull();
  expect(within(slot!).getByRole('button', { name: '用户管理' })).toHaveAttribute('aria-current', 'page');
  expect(f.root.querySelector('main')?.contains(slot)).toBe(false);
});
it('preserves explicit existing display preferences instead of silently resetting them', async () => {
  const f = await mountPlayground({ entry: '/system/roles?scopeKind=workspace&scopeId=south' });fixtures.push(f);
  await act(async()=>{f.runtime.preferences.update({tabbar:{enabled:false},breadcrumb:{enabled:false}});});
  expect(screen.queryByRole('navigation',{name:'打开的页面'})).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation',{name:'面包屑'})).not.toBeInTheDocument();
  expect(f.runtime.preferences.getSnapshot().core.tabbar.enabled).toBe(false);
});

it('routes brand navigation through the existing unsaved-input guard',async()=>{
 const f=await mountPlayground({entry:'/system/users?scopeKind=workspace&scopeId=north'});fixtures.push(f);
 await screen.findByRole('heading',{name:'用户管理'});
 await act(async()=>f.runtime.stores.interaction.setDirty('brand-protected-input',true));
 fireEvent.click(screen.getByRole('link',{name:'Template Playground'}));
 expect(await screen.findByRole('alertdialog')).toBeVisible();
 expect(f.runtime.router.state.location.pathname).toBe('/system/users');
});

it('opens current menu ancestors after asynchronous grants arrive',async()=>{
 const f=await mountPlayground({entry:'/embedded/frame-demo?scopeKind=workspace&scopeId=north'});fixtures.push(f);
 expect(await screen.findByTitle('内嵌页面')).toBeVisible();
 const nav=screen.getByRole('navigation',{name:'业务导航'});
 expect(await within(nav).findByRole('link',{name:'内嵌页面'})).toBeVisible();
 expect(within(nav).getByRole('link',{name:'文档'})).toHaveAttribute('rel','noopener noreferrer');
});
