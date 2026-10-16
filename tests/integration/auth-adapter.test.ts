import { mockFetchResponse } from './mock-response';
import { expect, it, vi } from 'vitest';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createRequestClient } from '@niubu/request';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';

it('restores only an authoritative user after a successful synthetic login and local invalidation blocks restore', async () => {
  const backend=createMockBackend();
  const fetcher=vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url=new URL(String(input));
    const response=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});
    return mockFetchResponse(response);
  });
  const request=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter:()=>{},errorNormalizer:error=>error,getGeneration:()=>0});
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const adapter=createPlaygroundAuthAdapter({request,storage});
  const controller=new AbortController();
  const op={signal:controller.signal,assertCurrent:()=>controller.signal.throwIfAborted()};
  expect(await adapter.restore(op)).toBeNull();
  const user=await adapter.login({username:'demo@playground.invalid',password:'demo-only'},op);
  expect(user.id).toBe('demo-user');
  expect(user.workspaces.map(scope=>scope.id)).toEqual(['north','south']);
  expect((await adapter.credentialsProvider(controller.signal)).headers).toHaveProperty('Authorization');
  expect((await adapter.restore(op))?.id).toBe('demo-user');
  adapter.invalidateLocal();
  expect(await adapter.restore(op)).toBeNull();
  expect(values.has('playground.auth.v1')).toBe(false);
  request.dispose(); backend.dispose();
});

it('does not persist a late login after its operation lease has been revoked', async () => {
  const backend=createMockBackend();
  let release!:()=>void, entered!:()=>void;
  const enteredUser=new Promise<void>(done=>{entered=done;});
  const continueUser=new Promise<void>(done=>{release=done;});
  const request=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:async(input,init)=>{
    const url=new URL(String(input));
    const result=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});
    if(url.pathname==='/api/user') {entered();await continueUser;}
    return mockFetchResponse(result);
  },credentialsProvider:()=>({credentials:'omit'}),activityReporter:()=>{},errorNormalizer:error=>error,getGeneration:()=>0});
  const values=new Map<string,string>();
  const adapter=createPlaygroundAuthAdapter({request,storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}}});
  let current=true;
  const op={signal:new AbortController().signal,assertCurrent(){if(!current)throw new DOMException('retired','AbortError');}};
  const pending=adapter.login({username:'demo@playground.invalid',password:'demo-only'},op);
  await enteredUser; current=false; release();
  await expect(pending).rejects.toMatchObject({name:'AbortError'});
  expect(values.has('playground.auth.v1')).toBe(false);
  expect(Boolean(adapter.credentialsProvider(new AbortController().signal).headers.Authorization)).toBe(false);
  request.dispose();backend.dispose();
});

it('refreshes an explicitly expired persisted access token once during startup', async () => {
  let now=0;
  const backend=createMockBackend({now:()=>now});
  let refreshes=0;
  const request=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:async(input,init)=>{
    const url=new URL(String(input)); if(url.pathname==='/api/auth/refresh')refreshes++;
    const result=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});
    return mockFetchResponse(result);
  },credentialsProvider:()=>({credentials:'omit'}),activityReporter:()=>{},errorNormalizer:error=>error,getGeneration:()=>0});
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const op={signal:new AbortController().signal,assertCurrent(){}};
  const original=createPlaygroundAuthAdapter({request,storage});
  await original.login({username:'demo@playground.invalid',password:'demo-only'},op);
  original.dispose();now=300_001;
  const restored=createPlaygroundAuthAdapter({request,storage});
  expect((await restored.restore(op))?.id).toBe('demo-user');
  expect(refreshes).toBe(1);
  restored.dispose();request.dispose();backend.dispose();
});
