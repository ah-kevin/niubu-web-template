import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AuthenticationForm } from '@niubu/common-ui/auth';
const requireFromApp=createRequire(resolve(import.meta.dirname,'../../package.json'));
const shared=readFileSync(requireFromApp.resolve('@niubu/common-ui/auth/styles.css'),'utf8');
const local=readFileSync(resolve(import.meta.dirname,'login.css'),'utf8');
let sheet:HTMLStyleElement|undefined;
afterEach(()=>sheet?.remove());
const labels=(prefix:string)=>({eyebrow:'',heading:prefix,description:'',submit:'Submit',email:prefix+' account',password:prefix+' password',passwordPlaceholder:'Password',emailError:'Email required',passwordError:'Password required',submitError:'Try again',resultTitles:{'not-submitted':'Pending',error:'Failed',success:'Done'}});
it.each(['light','dark'])('keeps login input boundaries as legible as the public authentication control in %s mode',mode=>{
 sheet=document.createElement('style');
 const colors={'control-border':mode==='light'?'#767680':'#7f7f88',border:mode==='light'?'#e4e4e7':'#36363a',card:mode==='light'?'#ffffff':'#1c1e23',foreground:mode==='light'?'#18181b':'#f4f4f5'};
 // JSDOM does not resolve custom properties inside border shorthand; expand only
 // the four explicit palette inputs, then let its CSS cascade style the real form.
 sheet.textContent=(shared+'\n'+local).replace(/var\(--(control-border|border|card|foreground)(?:,[^)]*)?\)/g,(_match,name:keyof typeof colors)=>colors[name]);
 document.head.append(sheet);
 render(<><AuthenticationForm mode="login" labels={labels('Shared')} onSubmit={async()=>({kind:'success'})}/><div className="template-auth"><AuthenticationForm mode="login" labels={labels('Template')} onSubmit={async()=>({kind:'success'})}/></div></>);
 const original=getComputedStyle(screen.getByLabelText('Shared account'));
 const current=getComputedStyle(screen.getByLabelText('Template account'));
 expect(current.borderTopColor).toBe(original.borderTopColor);
 expect(current.backgroundColor).toBe(original.backgroundColor);
});
