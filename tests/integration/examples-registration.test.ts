import { expect, it } from 'vitest';
import { registry } from '../../apps/playground/src/modules/demo';
import { resolvePlaygroundAccess } from '../../apps/playground/src/auth/access';
import { scopedFixtures } from '../../apps/backend-mock/src/fixtures';
const slugs=['forms','tables','components','feedback','access','navigation','browser','requests','query','preferences','tabs'];
it('registers every confirmed group with static loader and authorized backend menu selection, hidden detail remains direct-only',()=>{
  const routes=registry.routes.filter(r=>r.id.startsWith('playground.examples.'));
  expect(routes.map(r=>r.path)).toEqual([...slugs.map(s=>`/examples/${s}`),'/examples/tabs/:id','/examples/navigation/second','/examples/navigation/third','/examples/navigation/third/deep','/examples/navigation/detail','/examples/complete-list']);
  const access=resolvePlaygroundAccess({status:'ready',user:{id:'synthetic',name:'Synthetic',roles:['admin'],workspaces:[{kind:'workspace',id:'north'}]},menu:scopedFixtures.north.menu,codes:scopedFixtures.north.codes,scope:{kind:'workspace',id:'north'},generation:1,error:null,loginExpired:false});
  for(const route of routes){expect(registry.loaders[route.path]).toBeTypeOf('function');expect(access.grantedPageIds).toContain(route.id);}
  expect(routes.filter(r=>r.navigation)).toHaveLength(12);
  expect(routes.find(r=>r.path==='/examples/tabs/:id')?.hideInMenu).toBe(true);
});
