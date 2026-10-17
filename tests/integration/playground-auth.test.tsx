import { mockFetchResponse } from './mock-response';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { createRequestClient } from '@niubu/request';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';
import { startPlayground } from '../../apps/playground/src/main';

const cleanups:Array<()=>void>=[];
afterEach(async()=>{await act(async()=>{for(const dispose of cleanups.splice(0))dispose();});document.body.innerHTML='';localStorage.clear();sessionStorage.clear();});
function fixture(now?:()=>number, rejectRefresh?:()=>boolean) {
  const backend=createMockBackend({now});cleanups.push(()=>backend.dispose());
  const calls:Array<{path:string;username?:string}>=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));
    calls.push({path:url.pathname,...(url.pathname==='/api/auth/login'&&typeof init?.body==='string'?{username:JSON.parse(init.body).username}:{})});
    if(url.pathname==='/api/auth/refresh'&&rejectRefresh?.())return new Response(JSON.stringify({code:'INVALID_REFRESH',data:null,message:'Expired'}),{status:401});
    const response=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});
    return mockFetchResponse(response);
  };
  const values=new Map<string,string>();
  const authStorage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const reload=vi.fn();
  async function seed(username='demo@playground.invalid') {
    const request=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter(){},errorNormalizer:e=>e,getGeneration:()=>0});
    const adapter=createPlaygroundAuthAdapter({request,storage:authStorage});
    await adapter.login({username,password:'demo-only'},{signal:new AbortController().signal,assertCurrent(){}});
    adapter.dispose();request.dispose();
  }
  async function mount(entry:string) {
    const element=document.createElement('div');document.body.append(element);
    let runtime!:Awaited<ReturnType<typeof startPlayground>>;
    await act(async()=>{runtime=await startPlayground(element,{ runtimeConfig: {schemaVersion:1,apiURL:'/'},fetch:fetcher,authStorage,reload,createRouter:routes=>createMemoryRouter(routes,{initialEntries:[entry]})});});
    cleanups.push(()=>runtime.dispose());return runtime;
  }
  return {mount,seed,reload,calls,values};
}
function submit(form:HTMLElement,username='demo@playground.invalid') {
  fireEvent.change(within(form).getByLabelText('账号'),{target:{value:username}});
  fireEvent.change(within(form).getByLabelText('密码'),{target:{value:'demo-only'}});
  fireEvent.click(within(form).getByRole('button',{name:'登录'}));
}
it('uses the actual public login form and a safe scope-bearing return destination',async()=>{
  const f=fixture();const runtime=await f.mount('/request?scopeKind=workspace&scopeId=north');
  expect(await screen.findByRole('heading',{name:'欢迎回来'})).toBeVisible();
  const form=screen.getByRole('heading',{name:'欢迎回来'}).closest('section')!;
  submit(form);
  await waitFor(()=>expect(f.reload).toHaveBeenCalledWith('/request?scopeKind=workspace&scopeId=north'));
  expect(f.calls.filter(call=>call.path==='/api/auth/login').at(-1)?.username).toBe('demo@playground.invalid');
  expect(runtime.auth.getSnapshot().user).toBeNull();
});
it('changes workspace grants without reload and preserves the admitted page during same-person reauthentication',async()=>{
  const f=fixture();await f.seed();const runtime=await f.mount('/request?scopeKind=workspace&scopeId=north');
  expect(await screen.findByRole('heading',{name:'请求示例'})).toBeVisible();
  const router=runtime.router;
  expect(runtime.access().diagnostics.some(item=>item.pageId==='unknown.page')).toBe(true);
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'south'}});
  expect(await screen.findByRole('heading',{name:'无权访问'})).toBeVisible();
  expect(screen.queryByRole('link',{name:'请求示例'})).not.toBeInTheDocument();
  expect(f.reload).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'north'}});
  expect(await screen.findByRole('heading',{name:'请求示例'})).toBeVisible();
  fireEvent.change(screen.getByLabelText('回显内容'),{target:{value:'keep draft'}});
  await act(async()=>runtime.auth.markLoginExpired());
  const dialog=await screen.findByRole('dialog',{name:'会话已过期'});
  submit(dialog);
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'会话已过期'})).not.toBeInTheDocument());
  expect(screen.getByLabelText('回显内容')).toHaveValue('keep draft');
  expect(runtime.router).toBe(router);expect(f.reload).not.toHaveBeenCalled();
  await act(async()=>runtime.auth.markLoginExpired());
  submit(await screen.findByRole('dialog',{name:'会话已过期'}),'second@playground.invalid');
  await waitFor(()=>expect(f.reload).toHaveBeenCalledTimes(1));
  expect(runtime.auth.getSnapshot().user?.id).toBe('demo-user');
  await act(async()=>runtime.dispose());
  f.values.set('playground.auth.identity',JSON.stringify({version:1,identityKey:'untrusted-user'}));
  const next=await f.mount('/request?scopeKind=workspace&scopeId=north');
  expect(await screen.findByRole('heading',{name:'无权访问'})).toBeVisible();
  expect(next.preferences.identity.identityKey).toBe('second-user');
  expect(next.stores.session.getSnapshot().identityKey).toBe('second-user');
  expect(f.reload).toHaveBeenCalledTimes(1);
});
it('logs out by clearing its owned state and blocking automatic credential restore',async()=>{
  const f=fixture();await f.seed();const runtime=await f.mount('/home?scopeKind=workspace&scopeId=north');
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  const cacheKey=['playground','identity','demo-user','scope','workspace','north','generation',runtime.auth.getSnapshot().generation,'example'];
  runtime.queryClient.setQueryData(cacheKey,'old workspace value');
  fireEvent.keyDown(screen.getByRole('button',{name:'用户菜单'}),{key:'ArrowDown'});
  fireEvent.click(await screen.findByRole('menuitem',{name:'登出'}));
  await waitFor(()=>expect(f.reload).toHaveBeenCalledWith('/login'));
  expect(runtime.queryClient.getQueryData(cacheKey)).toBeUndefined();
  expect(runtime.stores.session.getSnapshot().disposed).toBe(true);
  expect(f.values.has('playground.auth.v1')).toBe(false);
  expect(runtime.auth.getSnapshot()).toMatchObject({user:null,codes:[],menu:[]});
});

it('renders safe external metadata and removes an embedded frame as soon as its scope grant is revoked',async()=>{
  const f=fixture();await f.seed();await f.mount('/embedded/frame-demo?scopeKind=workspace&scopeId=north');
  expect(await screen.findByTitle('内嵌页面')).toHaveAttribute('src','/frame-demo.html');
  const external=screen.getByRole('link',{name:'文档'});
  expect(external).toHaveAttribute('target','_blank');expect(external).toHaveAttribute('rel','noopener noreferrer');
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'south'}});
  expect(screen.queryByTitle('内嵌页面')).not.toBeInTheDocument();
  expect(await screen.findByRole('heading',{name:'无权访问'})).toBeVisible();
  expect(f.reload).not.toHaveBeenCalled();
});
it('never falls back to a granted workspace when a protected URL repeats scope parameters',async()=>{
  const f=fixture();await f.seed();await f.mount('/request?scopeKind=workspace&scopeId=north&scopeId=south');
  expect(await screen.findByRole('heading',{name:'无权访问'})).toBeVisible();
  expect(f.calls.some(call=>call.path==='/api/auth/codes')).toBe(false);
});

it('renews exactly once when access expires while workspace grants are being loaded',async()=>{
  let now=0;const f=fixture(()=>now);await f.seed();const runtime=await f.mount('/request?scopeKind=workspace&scopeId=north');
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  now=300_001;
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'south'}});
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  expect(runtime.auth.getSnapshot()).toMatchObject({scope:{kind:'workspace',id:'south'},loginExpired:false,codes:['demo:read']});
  expect(f.calls.filter(call=>call.path==='/api/auth/refresh')).toHaveLength(1);
});
it('clears every retired generation of the prior workspace after same-person reauthentication',async()=>{
  const f=fixture();await f.seed();const runtime=await f.mount('/request?scopeKind=workspace&scopeId=north');
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  const key=(generation:number)=>['playground','identity','demo-user','scope','workspace','north','generation',generation,'record'];
  const old=key(runtime.auth.getSnapshot().generation);runtime.queryClient.setQueryData(old,'older value');
  await act(async()=>runtime.auth.markLoginExpired());submit(await screen.findByRole('dialog',{name:'会话已过期'}));
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  const current=key(runtime.auth.getSnapshot().generation);runtime.queryClient.setQueryData(current,'current value');
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'south'}});
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  expect(runtime.queryClient.getQueryData(old)).toBeUndefined();expect(runtime.queryClient.getQueryData(current)).toBeUndefined();
});
it('a delayed retired cleanup cannot delete a newly re-entered workspace generation',async()=>{
  const f=fixture();await f.seed();const runtime=await f.mount('/request?scopeKind=workspace&scopeId=north');
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  let release!:()=>void,held=false;const gate=new Promise<void>(done=>{release=done;});
  const cancel=runtime.queryClient.cancelQueries.bind(runtime.queryClient);
  vi.spyOn(runtime.queryClient,'cancelQueries').mockImplementation(async(...args)=>{await cancel(...args);if(!held){held=true;await gate;}});
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'south'}});
  fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'north'}});
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  const fresh=['playground','identity','demo-user','scope','workspace','north','generation',runtime.auth.getSnapshot().generation,'record'];
  runtime.queryClient.setQueryData(fresh,'fresh value');
  await act(async()=>release());
  expect(runtime.queryClient.getQueryData(fresh)).toBe('fresh value');
});

it('opens actionable reauthentication if renewal fails while workspace grants are loading',async()=>{
  let now=0,denied=false;const f=fixture(()=>now,()=>denied);await f.seed();const runtime=await f.mount('/request?scopeKind=workspace&scopeId=north');
  await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  now=300_001;denied=true;fireEvent.change(screen.getByLabelText('工作空间'),{target:{value:'south'}});
  expect(await screen.findByRole('dialog',{name:'会话已过期'})).toBeVisible();
  expect(runtime.auth.getSnapshot()).toMatchObject({loginExpired:true,codes:[],menu:[]});
  expect(f.calls.filter(call=>call.path==='/api/auth/refresh')).toHaveLength(1);
});
