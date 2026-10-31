import { beforeAll, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Tabs, TabsList, TabsTrigger } from '@niubu/shadcn-ui/tabs';
import { Switch } from '@niubu/shadcn-ui/switch';
import { compilePlaygroundStyles, matchingRules, readCompiledRules, type CompiledStyleRule } from '../../tests/compiled-styles';
let rules: CompiledStyleRule[];
beforeAll(async () => { rules = readCompiledRules(await compilePlaygroundStyles()); });
it('emits body control CSS while preserving shell consumers', () => {
 render(<><Button variant="outline">Body</Button><div className="preference-drawer"><Button variant="outline">Shell</Button><Input aria-label="Shell input" /><Switch aria-label="Shell switch" /></div><Input aria-label="Body input" /><Switch aria-label="Body switch" /></>);
 const body = screen.getByRole('button', {name:'Body'});
 const shell = screen.getByRole('button', {name:'Shell'});
 const bodyRules = (el: Element, prop: string) => matchingRules(rules,el,prop).filter(rule => rule.selector.includes('not-in-'));
 expect(bodyRules(body,'border-color').some(rule => rule.style.getPropertyValue('border-color') === 'var(--border)')).toBe(true);
 expect(bodyRules(shell,'border-color')).toEqual([]);
 expect(bodyRules(screen.getByLabelText('Body switch'),'width').length).toBeGreaterThan(0);
 expect(bodyRules(screen.getByLabelText('Shell switch'),'width')).toEqual([]);
 expect(bodyRules(screen.getByLabelText('Body input'),'background-color').length).toBeGreaterThan(0);
 expect(bodyRules(screen.getByLabelText('Shell input'),'background-color')).toEqual([]);
});

it('retains loading colors and emits effective disabled cursors and focus rings', () => {
 render(<><Button disabled>Disabled</Button><Button disabled aria-busy>Busy</Button><Button size="icon" aria-label="Focused icon" /><Input aria-label="Focused input" /></>);
 const declarations=(el: Element,prop: string)=>matchingRules(rules,el,prop).map(rule=>rule.style.getPropertyValue(prop));
 const disabled=screen.getByRole('button',{name:'Disabled'});
 expect(declarations(disabled,'pointer-events').at(-1)).toBe('auto');
 expect(declarations(disabled,'cursor').at(-1)).toBe('not-allowed');
 expect(declarations(disabled,'background-color').at(-1)).toBe('var(--muted)');
 expect(declarations(screen.getByRole('button',{name:'Busy'}),'background-color').at(-1)).toBe('var(--primary)');
 const icon=screen.getByRole('button',{name:'Focused icon'});icon.focus();
 expect(declarations(icon,'outline-offset').at(-1)).toBe('1px');
 expect(declarations(icon,'outline-color').at(-1)).toBe('var(--focus-ring)');
 const input=screen.getByRole('textbox');input.focus();
 expect(declarations(input,'border-color').at(-1)).toBe('var(--ring)');
 expect(declarations(input,'outline-color').at(-1)).toBe('var(--focus-ring)');
});

it('keeps the dark line-tab indicator and background distinct from segmented tabs',()=>{
 render(<div className="dark"><Tabs defaultValue="a"><TabsList variant="line"><TabsTrigger value="a">Line active</TabsTrigger></TabsList></Tabs></div>);
 const tab=screen.getByRole('tab',{name:'Line active'});
 const values=(prop:string)=>matchingRules(rules,tab,prop).map(rule=>rule.style.getPropertyValue(prop));
 expect(values('background-color').at(-1)).toBe('rgba(0, 0, 0, 0)');
 expect(values('border-color').at(-1)).toBe('var(--primary)');
});

it.each(['ghost','link','link-danger'] as const)('keeps disabled %s buttons transparent',variant=>{
 render(<Button variant={variant} disabled>Disabled link</Button>);
 const button=screen.getByRole('button');
 const colors=matchingRules(rules,button,'background-color').map(rule=>rule.style.getPropertyValue('background-color'));
 expect(colors.at(-1)).toBe('rgba(0, 0, 0, 0)');
});
