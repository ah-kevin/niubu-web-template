import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {EventEmitter} from 'node:events';
const entry=fileURLToPath(new URL('../dev-server.ts',import.meta.url));
async function harness(failClose=false){
 const events=new EventEmitter(),messages=[],logs=[],hooks=new Map();let created=0,updated=0,closed=0,unwatched=0;
 const proc=Object.assign(new EventEmitter(),{argv:['node',entry,'--host','127.0.0.1','--port','5320'],send:message=>messages.push(message),connected:true,disconnect(){this.connected=false;this.emit('disconnect');}});
 const core={
  createNitro:async(_config,options)=>{created++;if(options?.watch&&options.c12?.onUpdate)events.on('config:change',options.c12.onUpdate);return {options:{_c12:{unwatch:async()=>{unwatched++;events.removeAllListeners('config:change');}}},hooks:{hookOnce:(n,f)=>hooks.set(n,f),hook:(n,f)=>hooks.set(n,f)},close:async()=>{closed++;if(failClose)throw Error('synthetic cleanup failed');},updateConfig:async()=>{updated++;}};},
  createDevServer:()=>({listen:async()=>({server:{address:()=>({port:5320,address:'127.0.0.1'})}})}),prepare:async()=>{},build:async()=>{}
 };
 const context=createContext({process:proc,console:{error:(...args)=>logs.push(args.join(' '))},Promise,Error});const modules=new Map();
 for(const [id,exports] of [['node:path',{resolve}],['node:url',{pathToFileURL}],['nitropack/core',core]])modules.set(id,new SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context}));
 const module=new SourceTextModule(stripTypeScriptTypes(readFileSync(entry,'utf8'),{mode:'strip'}),{context,identifier:pathToFileURL(entry).href,initializeImportMeta:meta=>{meta.url=pathToFileURL(entry).href;meta.dirname=dirname(entry);}});
 await module.link(id=>modules.get(id));await module.evaluate();
 const settle=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};await settle();assert.equal(messages.filter(x=>x.type==='mock:listening').length,1);
 return {proc,messages,logs,hooks,settle,change:key=>events.emit('config:change',{getDiff:()=>[{key}],newConfig:{config:{routeRules:{'/api/**':{headers:{'x-config':'updated'}}}}}}),counts:()=>({created,updated,closed,unwatched})};
}
test('runtimeConfig/routeRules changes are watched and applied without restarting',async()=>{const h=await harness();h.change('routeRules./api/**');await h.settle();try{assert.equal(h.counts().updated,1);assert.equal(h.counts().created,1);}finally{h.proc.emit('SIGTERM');await h.settle();}});
test('other config changes close the old watcher and restart exactly one strict listener',async()=>{const h=await harness();h.change('serveStatic');await h.settle();try{assert.equal(h.counts().created,2);assert.equal(h.counts().unwatched,1);assert.equal(h.counts().closed,1);assert.equal(h.messages.filter(x=>x.type==='mock:listening').length,2);assert.equal(typeof h.hooks.get('restart'),'function');}finally{h.proc.emit('SIGTERM');await h.settle();}});
test('child cleanup failure is sent to its supervisor and exits as failure',async()=>{const h=await harness(true);h.proc.emit('SIGTERM');await h.settle();assert.equal(h.proc.exitCode,1);assert.ok(h.messages.some(x=>x.type==='mock:cleanup-failed'));assert.equal(h.proc.connected,false);});
