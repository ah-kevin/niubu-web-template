import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { File } from 'node:buffer';
import { mountPlayground } from './playground-fixture';
it('uploads from the actual request page file control and exposes the real completed download action',async()=>{
 const f=await mountPlayground({entry:'/request?scopeKind=workspace&scopeId=north'});
 try{
  expect(await screen.findByRole('heading',{name:'上传与下载'})).toBeVisible();
  const bytes=Uint8Array.from({length:32769},(_,index)=>index%251),file=new File([bytes],'root-ui.json',{type:'application/json'});
  const input=screen.getByLabelText('演示文件');await waitFor(()=>expect(input).toBeEnabled());fireEvent.change(input,{target:{files:[file]}});
  fireEvent.click(screen.getByRole('button',{name:'上传'}));
  expect(await screen.findByText('上传已完成')).toBeVisible();
  expect(screen.getByText('服务端已确认 32769 / 32769 字节')).toBeVisible();expect(screen.getByRole('button',{name:'下载文件'})).toBeEnabled();
  expect(f.calls.filter(call=>call.method==='PUT'&&call.url.pathname.includes('/parts/')).map(call=>call.status)).toEqual([200,200]);
  expect(f.calls.filter(call=>call.method==='POST'&&call.url.pathname.endsWith('/complete')).map(call=>call.status)).toEqual([200]);
 }finally{await f.dispose();}
});
it('shows a failed recovery as an error without claiming a live session was cancelled',async()=>{
 let now=0,failRecovery=false;
 const f=await mountPlayground({entry:'/request?scopeKind=workspace&scopeId=north',now:()=>now,beforeResponse:(request,response)=>{if(failRecovery&&request.url.pathname==='/api/user'){if(response.kind!=='json')throw new Error('Expected JSON recovery');response.status=503;response.body={code:'UNAVAILABLE',data:null,message:'Synthetic recovery outage'};}}});
 try{
  const input=await screen.findByLabelText('演示文件');await waitFor(()=>expect(input).toBeEnabled());fireEvent.change(input,{target:{files:[new File([],'outage.bin')]}});now=300_001;failRecovery=true;
  fireEvent.click(screen.getByRole('button',{name:'上传'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('上传失败');expect(screen.queryByText('上传已停止；不能据此确认服务端已回滚。')).not.toBeInTheDocument();
  expect(f.runtime.auth.getSnapshot()).toMatchObject({status:'ready',loginExpired:false});expect(f.runtime.auth.requestContext().signal.aborted).toBe(false);expect(f.calls.filter(call=>call.url.pathname==='/api/auth/refresh')).toHaveLength(0);expect(f.calls.filter(call=>call.method==='POST'&&call.url.pathname==='/api/transfers')).toHaveLength(1);
 }finally{await f.dispose();}
});
