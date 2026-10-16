import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { Script } from 'node:vm';
import { serializeRuntimeConfig, parseRuntimeConfigScript } from '@niubu/utils/runtime-config';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { startPlayground } from '../../apps/playground/src/main';
import { mockFetchResponse } from './mock-response';
const disposers:Array<()=>void>=[];
afterEach(async()=>{await act(async()=>disposers.splice(0).reverse().forEach(dispose=>dispose()));document.body.innerHTML='';localStorage.clear();sessionStorage.clear();});
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};}
it.each([undefined,{schemaVersion:2,apiURL:'/'},{schemaVersion:1,apiURL:'https://api.template.invalid/unexpected-path'}])('rejects invalid or absent runtime input before creating identity owners or requests %#',async runtimeConfig=>{
 const root=document.createElement('div');document.body.append(root);const fetcher=vi.fn<typeof fetch>();let runtime:Awaited<ReturnType<typeof startPlayground>>|undefined,thrown:unknown;
 try {
  await act(async()=>{try{runtime=await startPlayground(root,{runtimeConfig,fetch:fetcher,authStorage:storage(),createRouter:routes=>createMemoryRouter(routes,{initialEntries:['/home']})});}catch(error){thrown=error;}});
  expect(thrown).toMatchObject({code:runtimeConfig===undefined?'RUNTIME_CONFIG_MISSING':'RUNTIME_CONFIG_INVALID'});expect(fetcher).not.toHaveBeenCalled();expect(root.textContent).toContain('RUNTIME_CONFIG_');
 }finally{await act(async()=>runtime?.dispose());root.remove();}
});
it('uses changed canonical script values in the actual app startup without a rebuild',async()=>{
 const backend=createMockBackend();disposers.push(()=>backend.dispose());
 for(const apiURL of ['https://api-a.template.invalid','https://api-b.template.invalid']) {
  const script=serializeRuntimeConfig({schemaVersion:1,apiURL});parseRuntimeConfigScript(script);
  const sandbox:{__APP_RUNTIME_CONFIG__?:unknown}={};new Script(script).runInNewContext(sandbox);
  const calls:string[]=[];const fetcher:typeof fetch=async(input,init)=>{const url=new URL(String(input));calls.push(url.href);const response=await backend.dispatch({method:init?.method??'GET',path:url.pathname,query:url.searchParams,headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body});return mockFetchResponse(response);};
  const root=document.createElement('div');document.body.append(root);let runtime!:Awaited<ReturnType<typeof startPlayground>>;
  await act(async()=>{runtime=await startPlayground(root,{runtimeConfig:sandbox.__APP_RUNTIME_CONFIG__,fetch:fetcher,authStorage:storage(),createRouter:routes=>createMemoryRouter(routes,{initialEntries:['/home']})});});
  try {expect(await screen.findByRole('heading',{name:'公共首页'})).toBeVisible();await waitFor(()=>expect(calls.filter(href=>new URL(href).pathname.startsWith('/api/')).length).toBeGreaterThan(0));expect([...new Set(calls.filter(href=>new URL(href).pathname.startsWith('/api/')).map(href=>new URL(href).origin))]).toEqual([apiURL]);}
  finally{await act(async()=>runtime.dispose());root.remove();}
 }
});
