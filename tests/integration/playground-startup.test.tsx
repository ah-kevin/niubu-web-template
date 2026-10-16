import { mockFetchResponse } from './mock-response';
import { act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { createRequestClient } from '@niubu/request';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';
import { startPlayground } from '../../apps/playground/src/main';
it('does not initialize owners when startup was already cancelled',async()=>{
  const root=document.createElement('div');document.body.append(root);const abort=new AbortController();abort.abort();const fetcher=vi.fn();
  let cancelled=false,runtime:Awaited<ReturnType<typeof startPlayground>>|undefined;
  await act(async()=>{try{runtime=await startPlayground(root,{ runtimeConfig: {schemaVersion:1,apiURL:'/'},signal:abort.signal,fetch:fetcher,authStorage:{getItem:()=>null,setItem(){},removeItem(){}},createRouter:routes=>createMemoryRouter(routes)});}catch(error){cancelled=typeof error==='object'&&error!==null&&'name'in error&&error.name==='AbortError';}runtime?.dispose();});
  root.remove();expect(cancelled).toBe(true);expect(fetcher).not.toHaveBeenCalled();
});
it('cancels authority restoration before an abandoned startup can persist or mount',async()=>{
  const backend=createMockBackend();let block=false,abandoned=false,writesAfterAbort=0,entered!:()=>void,release!:()=>void;
  const enteredUser=new Promise<void>(done=>{entered=done;}),continueUser=new Promise<void>(done=>{release=done;});
  const fetcher:typeof fetch=async(input,init)=>{const url=new URL(String(input));const response=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});if(block&&url.pathname==='/api/user'){entered();await continueUser;}return mockFetchResponse(response);};
  const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(abandoned)writesAfterAbort++;values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const channel=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter(){},errorNormalizer:e=>e,getGeneration:()=>0});
  const adapter=createPlaygroundAuthAdapter({request:channel,storage});await adapter.login({username:'demo@playground.invalid',password:'demo-only'},{signal:new AbortController().signal,assertCurrent(){}});adapter.dispose();channel.dispose();
  block=true;const abort=new AbortController(),root=document.createElement('div');document.body.append(root);let cancelled=false,runtime:Awaited<ReturnType<typeof startPlayground>>|undefined;
  await act(async()=>{const pending=startPlayground(root,{ runtimeConfig: {schemaVersion:1,apiURL:'/'},signal:abort.signal,fetch:fetcher,authStorage:storage,createRouter:routes=>createMemoryRouter(routes)});await enteredUser;abandoned=true;abort.abort();release();try{runtime=await pending;}catch(error){cancelled=typeof error==='object'&&error!==null&&'name'in error&&error.name==='AbortError';}runtime?.dispose();});
  expect(cancelled).toBe(true);expect(writesAfterAbort).toBe(0);expect(root.childElementCount).toBe(0);root.remove();backend.dispose();
});
