import { expect, it, vi } from 'vitest';
import { createRequestClient } from '@niubu/request';
import { isAccessExpired } from '@niubu/request/protocol';
import { createSessionRequest } from '../../apps/playground/src/auth/request';

const spec={path:'/api/demo/echo',method:'GET',activity:'foreground' as const,decode:(value:unknown)=>value};
it('denies anonymous, expired and incomplete grants without calling transport', async () => {
  const execute=vi.fn(); const controller=new AbortController();
  let snapshot={user:null as {id:string}|null,status:'ready',loginExpired:false};
  const client=createSessionRequest({mode:'enabled',execute,dispose(){}},{getSnapshot:()=>snapshot,requestContext:()=>({generation:0,signal:controller.signal})});
  expect((await client.execute(spec)).ok).toBe(false);
  snapshot={user:{id:'demo'},status:'ready',loginExpired:true};expect((await client.execute(spec)).ok).toBe(false);
  snapshot={user:{id:'demo'},status:'loading',loginExpired:false};expect((await client.execute(spec)).ok).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});
it('actively cancels an old workspace request without requiring another execute', async () => {
  let controller=new AbortController(), generation=0;
  let started!:()=>void; const entered=new Promise<void>(done=>{started=done;});
  const fetcher=vi.fn(async()=>{started();return new Promise<Response>(()=>{});});
  const base=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter(){},errorNormalizer:e=>e,getGeneration:()=>generation});
  const client=createSessionRequest(base,{getSnapshot:()=>({user:{id:'demo'},status:'ready',loginExpired:false}),requestContext:()=>({generation,signal:controller.signal})});
  const pending=client.execute(spec);await entered;
  controller.abort();controller=new AbortController();generation++;
  expect(await pending).toMatchObject({ok:false,error:{kind:'aborted'}});
  expect(fetcher).toHaveBeenCalledTimes(1);client.dispose();
});
it('keeps the valid owner signal during renewal and replays an idempotent request exactly once', async () => {
  const controller=new AbortController();let fresh=false;
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(fresh?{code:0,data:'done',message:'OK'}:{code:'ACCESS_EXPIRED',data:null,message:'Expired'}),{status:fresh?200:401}));
  const renewal=vi.fn(async()=>{fresh=true;return {ok:true as const,data:undefined};});
  const base=createRequestClient({mode:'enabled',baseURL:'http://playground.test',fetch:fetcher,credentialsProvider:()=>({credentials:'omit'}),activityReporter(){},errorNormalizer:e=>e,getGeneration:()=>7,renewal:{shouldRenew:isAccessExpired,renew:renewal}});
  const client=createSessionRequest(base,{getSnapshot:()=>({user:{id:'demo'},status:'ready',loginExpired:false}),requestContext:()=>({generation:7,signal:controller.signal})});
  expect(await client.execute(spec)).toEqual({ok:true,data:'done'});
  expect(renewal).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(2);
  expect(controller.signal.aborted).toBe(false);client.dispose();
});
