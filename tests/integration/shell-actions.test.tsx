import { act, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { mountPlayground } from './playground-fixture';
const fixtures:Array<Awaited<ReturnType<typeof mountPlayground>>>=[];
beforeAll(()=>vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}}));
afterAll(()=>vi.unstubAllGlobals());
afterEach(async()=>{for(const fixture of fixtures.splice(0))await fixture.dispose();localStorage.clear();sessionStorage.clear();});
it('opens the real user menu and routes its scoped profile link to the actual skeleton',async()=>{
 const f=await mountPlayground();fixtures.push(f);
 fireEvent.keyDown(await screen.findByRole('button',{name:'用户菜单'}),{key:'ArrowDown'});
 fireEvent.click(await screen.findByRole('menuitem',{name:'个人中心'}));
 expect(await screen.findByRole('heading',{name:'个人中心'})).toBeVisible();
 expect(f.runtime.router.state.location).toMatchObject({pathname:'/profile',search:'?scopeKind=workspace&scopeId=north'});
 expect(screen.getByText('个人资料编辑尚未接入。')).toBeVisible();
});

const lockCrypto={randomBytes:(size:number)=>new Uint8Array(size).fill(7),derive:async(password:string,salt:Uint8Array)=>Uint8Array.from({length:32},(_,index)=>((password.charCodeAt(index%password.length)||0)+(salt[index%salt.length]??0))%256)};
async function menuAction(name:string){fireEvent.keyDown(screen.getByRole('button',{name:'用户菜单'}),{key:'ArrowDown'});fireEvent.click(await screen.findByRole('menuitem',{name}));}
async function unlock(password='local-example'){
 const dialog=await screen.findByRole('dialog',{name:'本机界面已锁定'});
 fireEvent.change(within(dialog).getByLabelText('本地锁密码'),{target:{value:password}});
 fireEvent.click(within(dialog).getByRole('button',{name:'解锁'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'本机界面已锁定'})).not.toBeInTheDocument());
}
it('keeps functional confirmations under the business inert boundary while a local lock is active',async()=>{
 const f=await mountPlayground({startup:{lockCrypto}});fixtures.push(f);
 await act(async()=>f.runtime.stores.interaction.setDirty('root-dirty-owner',true));
 await menuAction('登出');const confirmation=await screen.findByRole('alertdialog',{name:'确认登出？'});
 await act(async()=>{expect(await f.runtime.lock!.lock('local-example',new AbortController().signal)).toBe(true);});
 const dialog=await screen.findByRole('dialog',{name:'本机界面已锁定'});
 expect(confirmation.isConnected).toBe(true);expect(confirmation.closest('[inert]')).not.toBeNull();
 expect(dialog.closest('[inert]')).toBeNull();expect(dialog).not.toHaveAttribute('aria-hidden','true');
 expect(f.reloads).toHaveLength(0);expect(f.runtime.stores.interaction.getSnapshot().dirty).toBe(true);
 await unlock();expect(await screen.findByRole('alertdialog',{name:'确认登出？'})).toBeVisible();
 fireEvent.click(within(confirmation).getByRole('button',{name:'取消'}));
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
 expect(f.runtime.auth.getSnapshot().user?.id).toBe('demo-user');expect(f.reloads).toHaveLength(0);
});
it('locks through the actual user menu, rejects a wrong password and keeps it out of preferences',async()=>{
 const f=await mountPlayground({startup:{lockCrypto}});fixtures.push(f);
 await menuAction('锁屏');const setup=await screen.findByRole('dialog',{name:'设置本机界面锁'});
 fireEvent.change(within(setup).getByLabelText('本地锁密码'),{target:{value:'local-example'}});
 fireEvent.click(within(setup).getByRole('button',{name:'锁定界面'}));
 const locked=await screen.findByRole('dialog',{name:'本机界面已锁定'});
 expect(f.runtime.lock?.getSnapshot().locked).toBe(true);
 expect([...f.storageValues.values()].some(value=>value.includes('local-example'))).toBe(false);
 expect(JSON.stringify(f.runtime.preferences.getSnapshot())).not.toContain('PBKDF2');
 within(locked).getByRole('button',{name:'解锁'}).focus();
 const modifier=/Mac|iPhone|iPad|iPod/i.test(navigator.platform)?{metaKey:true}:{ctrlKey:true};
 fireEvent.keyDown(within(locked).getByRole('button',{name:'解锁'}),{key:'k',...modifier});
 fireEvent.keyDown(within(locked).getByRole('button',{name:'解锁'}),{key:',',...modifier});
 expect(screen.queryByRole('dialog',{name:'搜索工作空间'})).not.toBeInTheDocument();
 fireEvent.change(within(locked).getByLabelText('本地锁密码'),{target:{value:'wrong-local'}});
 fireEvent.click(within(locked).getByRole('button',{name:'解锁'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('本地密码不正确');
 expect(f.runtime.lock?.getSnapshot().locked).toBe(true);expect(within(locked).getByLabelText('本地锁密码')).toHaveValue('');
 await unlock();expect(await screen.findByRole('heading',{name:'公共首页'})).toBeVisible();
});
it('preserves the same dirty form and owner through lock, same-person reauthentication and unlock',async()=>{
 const f=await mountPlayground({entry:'/system/roles?scopeKind=workspace&scopeId=north',startup:{lockCrypto}});fixtures.push(f);
 fireEvent.click(await screen.findByRole('button',{name:'新增'}));
 const input=await screen.findByRole('textbox',{name:'名称'});
 fireEvent.change(input,{target:{value:'Locked draft'}});fireEvent.change(screen.getByRole('textbox',{name:'编码'}),{target:{value:'locked-draft'}});
 const owner=f.runtime.lock;await act(async()=>{expect(await owner!.lock('local-example',new AbortController().signal)).toBe(true);});
 await screen.findByRole('dialog',{name:'本机界面已锁定'});expect(input.isConnected).toBe(true);expect(input.closest('[inert]')).not.toBeNull();
 await act(async()=>f.runtime.auth.markLoginExpired());
 const reauth=await screen.findByRole('dialog',{name:'会话已过期'});
 expect(reauth.closest('[inert]')).toBeNull();expect(reauth).not.toHaveAttribute('aria-hidden','true');
 expect(screen.queryByRole('dialog',{name:'本机界面已锁定'})).not.toBeInTheDocument();
 fireEvent.change(within(reauth).getByLabelText('账号'),{target:{value:'demo@playground.invalid'}});fireEvent.change(within(reauth).getByLabelText('密码'),{target:{value:'demo-only'}});fireEvent.click(within(reauth).getByRole('button',{name:'登录'}));
 await screen.findByRole('dialog',{name:'本机界面已锁定'});expect(f.runtime.lock).toBe(owner);expect(input.isConnected).toBe(true);expect(input).toHaveValue('Locked draft');expect(f.runtime.stores.interaction.getSnapshot().dirty).toBe(true);
 await unlock();expect(screen.getByRole('textbox',{name:'名称'})).toBe(input);expect(input).toHaveValue('Locked draft');
 await waitFor(()=>expect(screen.getByRole('button',{name:'保存'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'保存'}));
 fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button',{name:'确认保存'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 expect(f.calls.filter(call=>call.method==='POST'&&call.url.pathname==='/api/system/roles').map(call=>call.status)).toEqual([200]);
 expect(f.runtime.stores.interaction.getSnapshot().dirty).toBe(false);
});
it('requires a dirty sign-out decision and then clears only owned identity state',async()=>{
 const f=await mountPlayground({startup:{lockCrypto}});fixtures.push(f);
 await act(async()=>{f.runtime.stores.interaction.setDirty('root-active-editor',true);f.runtime.preferences.update({theme:{mode:'dark'}});});
 const other=JSON.stringify(['playground','template-playground','local','other-user','local-lock',1]);f.storageValues.set(other,'{"fixture":"other identity"}');
 await menuAction('登出');fireEvent.click(within(await screen.findByRole('alertdialog',{name:'确认登出？'})).getByRole('button',{name:'取消'}));
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());expect(f.reloads).toHaveLength(0);expect(f.runtime.auth.getSnapshot().user?.id).toBe('demo-user');
 await menuAction('登出');fireEvent.click(within(await screen.findByRole('alertdialog',{name:'确认登出？'})).getByRole('button',{name:'确定'}));
 await waitFor(()=>expect(f.reloads).toEqual(['/login']));expect(f.authValues.has('playground.auth.v1')).toBe(false);expect(f.runtime.stores.session.getSnapshot().disposed).toBe(true);
 expect(f.storageValues.get(other)).toBe('{"fixture":"other identity"}');expect([...f.storageValues.keys()].some(key=>key.startsWith('playground.preferences:'))).toBe(true);
});
it('only prompts for updates and checks live dirty state again before a user reload',async()=>{
 let etag='"v1"';const f=await mountPlayground({indexFetch:async()=>new Response(null,{status:200,headers:{ETag:etag}})});fixtures.push(f);
 await act(async()=>f.runtime.updates.check());etag='"v2"';await act(async()=>f.runtime.updates.check());
 const reload=await screen.findByRole('button',{name:'刷新以更新'});expect(f.reloads).toHaveLength(0);
 act(()=>f.runtime.stores.interaction.setDirty('late-edit',true));expect(reload).toBeDisabled();expect(screen.getByText('请先处理未保存的输入。')).toBeVisible();
 act(()=>f.runtime.stores.interaction.setDirty('late-edit',false));expect(reload).toBeEnabled();
 act(()=>{f.runtime.stores.interaction.setDirty('late-edit',true);fireEvent.click(reload);});expect(f.reloads).toHaveLength(0);
 act(()=>f.runtime.stores.interaction.setDirty('late-edit',false));fireEvent.click(reload);expect(f.reloads).toEqual(['/home?scopeKind=workspace&scopeId=north']);
});
it('does not mount a late business editor above the active lock and admits it only after unlock',async()=>{
 let release!:()=>void,entered!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
 const f=await mountPlayground({entry:'/system/roles?scopeKind=workspace&scopeId=north',startup:{lockCrypto},beforeResponse:async request=>{if(request.method==='GET'&&request.url.pathname==='/api/system/roles/role-north-operator'){entered();await pending;}}});fixtures.push(f);
 fireEvent.click(await screen.findByRole('button',{name:'编辑 Operator'}));await act(async()=>started);
 await act(async()=>{expect(await f.runtime.lock!.lock('local-example',new AbortController().signal)).toBe(true);});
 const locked=await screen.findByRole('dialog',{name:'本机界面已锁定'});await act(async()=>release());
 expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();expect(locked).not.toHaveAttribute('aria-hidden','true');expect(locked.closest('[inert]')).toBeNull();
 await unlock();expect(await screen.findByRole('textbox',{name:'名称'})).toHaveValue('Operator');
});
