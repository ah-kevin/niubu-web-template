import { expect, it } from 'vitest';
import { mockFetchResponse } from './mock-response';

it('keeps exact binary bytes and response headers at the injected fetch boundary', async () => {
  const response = mockFetchResponse({kind:'binary',status:200,headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="example.json"'},body:new Uint8Array([0,255,123,125])});
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0,255,123,125]);
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="example.json"');
});
it('preserves the sole JSON failure envelope instead of converting it into file bytes', async () => {
  const response=mockFetchResponse({kind:'json',status:403,headers:{'content-type':'application/json'},body:{code:'FORBIDDEN',data:null,message:'Denied'}});
  expect(response.status).toBe(403);expect(await response.json()).toEqual({code:'FORBIDDEN',data:null,message:'Denied'});
});
