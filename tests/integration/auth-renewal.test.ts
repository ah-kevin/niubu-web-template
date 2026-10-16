import { mockFetchResponse } from './mock-response';
import { expect, it, vi } from 'vitest';
import { createAuthSession } from '@niubu/stores';
import { createRequestClient, isAccessExpired } from '@niubu/request';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';
import { createSessionRequest } from '../../apps/playground/src/auth/request';

it('renews through the real session adapter once without aborting waiting requests, then revokes grants on a real renewal failure',async()=>{
  let now=0,refreshes=0,rejectRefresh=false;
  const backend=createMockBackend({now:()=>now});
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/api/auth/refresh'){
      refreshes++;
      if(rejectRefresh)return new Response(JSON.stringify({code:'INVALID_REFRESH',data:null,message:'Expired'}),{status:401});
    }
    const response=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});
    return mockFetchResponse(response);
  };
  const channel=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter(){},errorNormalizer:e=>e,getGeneration:()=>0});
  const saved=new Map<string,string>();
  const adapter=createPlaygroundAuthAdapter({request:channel,storage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>{saved.set(key,value);},removeItem:key=>{saved.delete(key);}}});
  await adapter.login({username:'demo@playground.invalid',password:'demo-only'},{signal:new AbortController().signal,assertCurrent(){}});
  const auth=createAuthSession({adapter,onIdentityReset(){},onScopeReset(){},reload:vi.fn(),homeHref:'/home',loginHref:'/login'});
  await auth.restore();await auth.switchScope({kind:'workspace',id:'north'});
  const base=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:signal=>adapter.credentialsProvider(signal),activityReporter(){},errorNormalizer:e=>e,getGeneration:()=>auth.requestContext().generation,renewal:{shouldRenew:isAccessExpired,renew:async signal=>{try{await auth.refresh(signal);return {ok:true,data:undefined};}catch{return {ok:false,error:{kind:'http',status:401,code:'LOGIN_EXPIRED'}};}}}});
  const request=createSessionRequest(base,auth);
  const context=auth.requestContext();now=300_001;
  const spec={path:'/api/auth/codes',method:'GET',query:{scopeKind:'workspace',scopeId:'north'},activity:'background' as const,decode:(data:unknown)=>data};
  const results=await Promise.all([request.execute(spec),request.execute(spec),request.execute(spec)]);
  expect(results.every(result=>result.ok)).toBe(true);expect(refreshes).toBe(1);
  expect(auth.requestContext().generation).toBe(context.generation);expect(context.signal.aborted).toBe(false);
  now=600_002;rejectRefresh=true;
  expect((await request.execute(spec)).ok).toBe(false);
  expect(auth.getSnapshot()).toMatchObject({loginExpired:true,codes:[],menu:[]});
  expect(context.signal.aborted).toBe(true);expect(refreshes).toBe(2);
  expect((await request.execute(spec)).ok).toBe(false);expect(refreshes).toBe(2);
  request.dispose();auth.dispose();adapter.dispose();channel.dispose();backend.dispose();
});
