import { expect, it } from 'vitest';
import { createAuthSession } from '@niubu/stores';

it('a cancelled login form lease cannot later publish credentials or reload its identity', async () => {
  let release!:()=>void; const finish=new Promise<void>(done=>{release=done;});
  const user={id:'demo',name:'Demo',roles:[],workspaces:[]};
  let committed=false, reloaded=false;
  const session=createAuthSession({adapter:{restore:async()=>null,login:async(_input:unknown,op)=>{await finish;op.assertCurrent();committed=true;return user;},logout:async()=>{},refresh:async()=>{},getCodes:async()=>[],getMenu:async()=>[],credentialsProvider:()=>({credentials:'omit'}),invalidateLocal(){}},onIdentityReset(){},onScopeReset(){},reload(){reloaded=true;},homeHref:'/home',loginHref:'/login'});
  await session.restore();
  const form=new AbortController();
  const login=session.login({},'/home',form.signal);
  form.abort(); release();
  await expect(login).rejects.toMatchObject({name:'AbortError'});
  expect(committed).toBe(false);expect(reloaded).toBe(false);
  session.dispose();
});
