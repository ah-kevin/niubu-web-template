import { expect, it } from 'vitest';
import type { AccessMenuNode, RouteMeta } from '@niubu/access';
import { buildPlaygroundBreadcrumbs } from './breadcrumbs';
const meta=(id:string,path:string):RouteMeta=>({id,path,titleKey:id,iconToken:'home',order:0,navigation:true,scope:'workspace',capability:null});
const menu:readonly AccessMenuNode[]=[{kind:'page',id:'home',pageId:'playground.home',title:'app:home',href:'/home?scopeKind=workspace&scopeId=south'},{kind:'group',id:'components',title:'app:navigation.components',children:[{kind:'page',id:'forms',pageId:'forms',title:'app:examples.forms',href:'/examples/forms?scopeKind=workspace&scopeId=south'}]}];
it('uses the selected authorized menu ancestry and scoped links',()=>{
 const result=buildPlaygroundBreadcrumbs(menu,meta('forms','/examples/forms'),'/examples/forms',[meta('forms','/examples/forms')]);
 expect(result.map(r=>[r.labelKey,r.href,r.current])).toEqual([['app:home','/home?scopeKind=workspace&scopeId=south',false],['app:navigation.components',undefined,false],['app:examples.forms',undefined,true]]);
});
it('includes a visible registered parent for a menu-hidden detail without creating a link to the parameter pattern',()=>{
 const result=buildPlaygroundBreadcrumbs(menu,meta('detail','/examples/forms/:id'),'/examples/forms/sample-1',[meta('forms','/examples/forms')]);
 expect(result.at(-2)).toMatchObject({id:'forms',href:'/examples/forms?scopeKind=workspace&scopeId=south',current:false});
 expect(result.at(-1)).toMatchObject({labelKey:'detail',current:true});
 expect(result.some(r=>r.href?.includes(':id'))).toBe(false);
});

it('uses authorized iframe menu ancestry instead of dropping back to the generic route title',()=>{
 const embedded:readonly AccessMenuNode[]=[...menu,{kind:'group',id:'features',title:'app:navigation.features',children:[{kind:'iframe',id:'local-frame',title:'app:navigation.embedded',src:'/frame-demo.html'}]}];
 const result=buildPlaygroundBreadcrumbs(embedded,meta('playground.embedded','/embedded/:menuId'),'/embedded/local-frame',[]);
 expect(result.map(r=>r.labelKey)).toEqual(['app:home','app:navigation.features','app:navigation.embedded']);
 expect(result.at(-1)).toMatchObject({id:'local-frame',current:true});
});
