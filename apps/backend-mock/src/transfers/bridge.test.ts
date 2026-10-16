import { expect, it, vi } from 'vitest';
import { sendMockResponse } from './bridge';
it('writes exact binary bytes without serializing or replacing them',()=>{
 const bytes=new Uint8Array([0,255,123,125]),setStatus=vi.fn(),setHeader=vi.fn(),end=vi.fn();
 sendMockResponse({kind:'binary',status:200,headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="example.json"'},body:bytes},{setStatus,setHeader,end});
 expect(setStatus).toHaveBeenCalledWith(200);expect(setHeader).toHaveBeenCalledWith('content-type','application/octet-stream');expect(end).toHaveBeenCalledOnce();expect(end.mock.calls[0]![0]).toEqual(bytes);expect(typeof end.mock.calls[0]![0]).not.toBe('string');
});
it('serializes the unique JSON envelope once and preserves an HTTP failure',()=>{
 const setStatus=vi.fn(),setHeader=vi.fn(),end=vi.fn();
 sendMockResponse({kind:'json',status:401,headers:{'content-type':'application/json; charset=utf-8'},body:{code:'ACCESS_EXPIRED',data:null,message:'Expired'}},{setStatus,setHeader,end});
 expect(setStatus).toHaveBeenCalledWith(401);expect(end).toHaveBeenCalledExactlyOnceWith('{"code":"ACCESS_EXPIRED","data":null,"message":"Expired"}');
});
