import { expect, it, vi } from 'vitest';
import { readPlaygroundIdentityHint } from './identity-hint';

it('uses only an isolated public identity hint for appearance, never the credential record',()=>{
  const read=vi.fn((key:string)=>{
    if(key==='playground.auth.restore-blocked')return null;
    if(key==='playground.auth.identity')return JSON.stringify({version:1,identityKey:'demo-user'});
    throw new Error('The appearance reader must not read credentials');
  });
  expect(readPlaygroundIdentityHint({getItem:read})).toBe('demo-user');
  expect(read.mock.calls.map(call=>call[0])).not.toContain('playground.auth.v1');
});
it('falls back to anonymous for logout suppression, malformed or unavailable visual hints',()=>{
  expect(readPlaygroundIdentityHint({getItem:()=> '1'})).toBe('anonymous');
  expect(readPlaygroundIdentityHint({getItem:key=>key.endsWith('identity')?'not json':null})).toBe('anonymous');
  expect(readPlaygroundIdentityHint({getItem:()=>{throw new Error('unavailable');}})).toBe('anonymous');
});
