import { act } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { createRequestClient } from '@niubu/request';
import { createMockBackend, type MockResponse } from '../../apps/backend-mock/src/dispatcher';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';
import { startPlayground } from '../../apps/playground/src/main';
import { mockFetchResponse } from './mock-response';

type StartupOptions=NonNullable<Parameters<typeof startPlayground>[1]>;
export type FixtureCall={url:URL;method:string;body:unknown;signal?:AbortSignal|null;status:number};
export type FixtureOptions={
 entry?:string;username?:string;now?:()=>number;
 startup?:Partial<StartupOptions>;
 beforeResponse?:(request:Omit<FixtureCall,'status'>,response:MockResponse)=>void|Promise<void>;
 indexFetch?:typeof fetch;
};
export async function mountPlayground({entry='/home?scopeKind=workspace&scopeId=north',username='demo@playground.invalid',now,startup={},beforeResponse,indexFetch}:FixtureOptions={}){
 const backend=createMockBackend({now});const authValues=new Map<string,string>(),storageValues=new Map<string,string>();
 const authStorage={getItem:(key:string)=>authValues.get(key)??null,setItem:(key:string,value:string)=>{authValues.set(key,value);},removeItem:(key:string)=>{authValues.delete(key);}};
 const storage={read:(key:string)=>({ok:true as const,value:storageValues.get(key)??null}),write:(key:string,value:string)=>{storageValues.set(key,value);return {ok:true as const};}};
 const calls:FixtureCall[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(!url.pathname.startsWith('/api/'))return indexFetch?indexFetch(input,init):new Response(null,{status:200,headers:{ETag:'"fixture-v1"','Last-Modified':'Fri, 16 Oct 2026 10:00:00 GMT'}});
  const request={url,method:init?.method??'GET',body:typeof init?.body==='string'?JSON.parse(init.body):init?.body,signal:init?.signal};
  const response=await backend.dispatch({method:request.method,path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});
  calls.push({...request,status:response.status});await beforeResponse?.(request,response);return mockFetchResponse(response);
 };
 const seed=createRequestClient({mode:'enabled',baseURL:'http://fixture.invalid',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter(){},errorNormalizer:error=>error,getGeneration:()=>0});
 const adapter=createPlaygroundAuthAdapter({request:seed,storage:authStorage});
 await adapter.login({username,password:'demo-only'},{signal:new AbortController().signal,assertCurrent(){}});adapter.dispose();seed.dispose();
 const root=document.createElement('div');document.body.append(root);const reloads:string[]=[];
 let runtime!:Awaited<ReturnType<typeof startPlayground>>;
 try {
  await act(async()=>{runtime=await startPlayground(root,{runtimeConfig:{schemaVersion:1,apiURL:'/'},fetch:fetcher,authStorage,storage,reload:href=>{reloads.push(href);},createRouter:routes=>createMemoryRouter(routes,{initialEntries:[entry]}),...startup});});
 }catch(error){backend.dispose();root.remove();throw error;}
 return {runtime,backend,calls,authValues,storageValues,reloads,root,async dispose(){await act(async()=>runtime.dispose());backend.dispose();root.remove();}};
}
