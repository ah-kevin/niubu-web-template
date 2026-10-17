import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { mountPlayground } from './playground-fixture';
const fixtures:Awaited<ReturnType<typeof mountPlayground>>[]=[];
afterEach(async()=>{for(const f of fixtures.splice(0))await f.dispose();});
it('opens two stable detail identities, refreshes current content and closes through the real routing controller',async()=>{
 const f=await mountPlayground({entry:'/examples/tabs?scopeKind=workspace&scopeId=north'});fixtures.push(f);
 fireEvent.click(await screen.findByRole('link',{name:'打开详情 A'}));
 expect(await screen.findByRole('heading',{name:'标签详情 A'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'刷新当前示例'}));
 await waitFor(()=>expect(f.runtime.stores.tabs.getSnapshot().tabs.some(t=>t.refreshNonce===1)).toBe(true));
 fireEvent.click(screen.getByRole('link',{name:'打开详情 B'}));
 expect(await screen.findByRole('heading',{name:'标签详情 B'})).toBeVisible();
 const tabs=f.runtime.stores.tabs.getSnapshot().tabs;expect(tabs.some(t=>t.routeId==='playground.examples.tab-detail'&&t.href.includes('/A'))).toBe(true);
 expect(tabs.some(t=>t.routeId==='playground.examples.tab-detail'&&t.href.includes('/B'))).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'关闭当前示例'}));
 await waitFor(()=>expect(f.runtime.stores.tabs.getSnapshot().tabs.some(t=>t.href.includes('/B'))).toBe(false));
 await act(async()=>f.runtime.router.navigate('/examples/forms?scopeKind=workspace&scopeId=unauthorized'));
 expect(await screen.findByRole('heading',{name:'无权访问'})).toBeVisible();
 expect(f.runtime.stores.tabs.getSnapshot().tabs.some(t=>t.href.includes('unauthorized'))).toBe(false);
});

it('keeps a refreshed admitted page and nonce during expiry without admitting a new destination',async()=>{
 const f=await mountPlayground({entry:'/request?scopeKind=workspace&scopeId=north'});fixtures.push(f);
 await screen.findByLabelText('回显内容');
 await act(async()=>{f.runtime.preferences.update({tabbar:{enabled:true,showRefresh:true}});});
 fireEvent.click(screen.getByRole('button',{name:'刷新页面'}));
 const key=f.runtime.stores.tabs.getSnapshot().activeKey!;
 await waitFor(()=>expect(f.runtime.stores.tabs.getSnapshot().tabs.find(t=>t.key===key)?.refreshNonce).toBe(1));
 const input=screen.getByLabelText('回显内容');fireEvent.change(input,{target:{value:'refreshed draft'}});
 await act(async()=>f.runtime.auth.markLoginExpired());
 expect(screen.getByLabelText('回显内容')).toBe(input);expect(input).toHaveValue('refreshed draft');
 expect(f.runtime.stores.tabs.getSnapshot().tabs.find(t=>t.key===key)?.refreshNonce).toBe(1);
 await act(async()=>f.runtime.router.navigate('/examples/tabs/A?scopeKind=workspace&scopeId=north'));
 expect(screen.queryByLabelText('临时内容')).not.toBeInTheDocument();
});

it('opens the projected new-window internal target through an actual registered route',async()=>{
 const f=await mountPlayground({entry:'/examples/navigation?scopeKind=workspace&scopeId=north'});fixtures.push(f);
 const nav=await screen.findByRole('navigation',{name:'合成菜单'});
 const link=within(nav).getByRole('link',{name:'Menu 2-1'});
 expect(link).toHaveAttribute('target','_blank');
 await act(async()=>f.runtime.router.navigate(link.getAttribute('href')!));
 expect(screen.queryByRole('heading',{name:'页面不存在'})).not.toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'菜单与面包屑 / Navigation'})).toBeVisible();
});

it.each(['north','south'])('opens and closes a menu-hidden page through registered route and tabs in %s',async(scopeId)=>{
 const f=await mountPlayground({entry:`/examples/navigation?scopeKind=workspace&scopeId=${scopeId}`});fixtures.push(f);
 const nav=await screen.findByRole('navigation',{name:'合成菜单'});
 expect(new URL(within(nav).getByRole('link',{name:'Menu 2-1'}).getAttribute('href')!,'https://example.invalid').searchParams.get('scopeId')).toBe(scopeId);
 fireEvent.click(screen.getByRole('link',{name:'在路由中打开隐藏详情'}));
 await waitFor(()=>expect(f.runtime.router.state.location.pathname).toBe('/examples/navigation/detail'));
 expect(await screen.findByText('隐藏详情可直接访问')).toBeVisible();
 expect(new URLSearchParams(f.runtime.router.state.location.search).get('scopeId')).toBe(scopeId);
 expect(f.runtime.auth.getSnapshot().scope?.id).toBe(scopeId);
 const key=f.runtime.stores.tabs.getSnapshot().activeKey!;
 fireEvent.click(screen.getByRole('button',{name:'关闭当前示例'}));
 await waitFor(()=>expect(f.runtime.stores.tabs.getSnapshot().tabs.some(t=>t.key===key)).toBe(false));
 expect(new URLSearchParams(f.runtime.router.state.location.search).get('scopeId')).toBe(scopeId);
});
