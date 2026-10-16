import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import * as budget from './budget';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(twoBuilds = true) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'template-budget-'))); roots.push(root);
  const put = (file: string, data: object | string) => { const path = join(root,file); mkdirSync(dirname(path),{recursive:true}); writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data)); };
  put('package.json',{name:'workspace',private:true,packageManager:'pnpm@11.25.0'});
  put('pnpm-workspace.yaml',"packages:\n  - 'apps/*'\n");
  put('apps/first/package.json',{name:'@fixture/first',private:true,scripts:{build:'fixture-build'}});
  put('apps/second/package.json',{name:'@fixture/second',private:true,scripts:twoBuilds?{build:'fixture-build'}:{dev:'fixture-dev'}});
  mkdirSync(join(root,'apps/second/src'),{recursive:true});
  return root;
}
const select = (root: string, name?: string) => (budget as unknown as { resolveBudgetApp(root:string,name?:string):{appName:string;appRoot:string} }).resolveBudgetApp(root,name);
it('selects the actual app from its caller directory without a product name default', () => {
  const root=fixture();
  expect(select(join(root,'apps/second/src'))).toMatchObject({appName:'@fixture/second',appRoot:join(root,'apps/second')});
});
it('requires explicit selection for multiple build apps at the workspace root', () => {
  const root=fixture();
  expect(()=>select(root)).toThrow(/select|ambiguous/i);
  expect(select(root,'@fixture/first').appName).toBe('@fixture/first');
});
it('selects the sole build app while a development service is also present', () => {
  const root=fixture(false);
  expect(select(root).appName).toBe('@fixture/first');
});
