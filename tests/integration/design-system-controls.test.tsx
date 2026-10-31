import { createRef, useState } from 'react';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberInput } from '../../packages/@core/ui-kit/shadcn-ui/src/number-input';
import { Button } from '../../packages/@core/ui-kit/shadcn-ui/src/button';
import { Badge } from '../../packages/@core/ui-kit/shadcn-ui/src/badge';
import { Checkbox } from '../../packages/@core/ui-kit/shadcn-ui/src/checkbox';
import { PaginationLink } from '../../packages/@core/ui-kit/shadcn-ui/src/pagination';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../packages/@core/ui-kit/shadcn-ui/src/tabs';
import { Select } from '../../packages/@core/ui-kit/shadcn-ui/src/select';

beforeAll(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterAll(() => vi.unstubAllGlobals());
it('retains numeric/null semantics, native decimal stepping, refs and bounds without submitting', async () => {
 const ref=createRef<HTMLInputElement>(); const blur=vi.fn(); const submit=vi.fn(e=>e.preventDefault());
 function Fixture(){const [value,setValue]=useState<number|null>(0.2); return <form onSubmit={submit}><NumberInput ref={ref} aria-label="Quantity" controls decreaseLabel="Less" increaseLabel="More" value={value} onValueChange={setValue} onBlur={blur} min={0} max={0.3} step={0.1}/><output>{String(value)}</output></form>;}
 render(<Fixture/>); const input=screen.getByRole('spinbutton'); expect(ref.current).toBe(input);
 input.focus(); await userEvent.click(screen.getByRole('button',{name:'More'})); expect(input).toHaveValue(0.3); expect(blur).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled(); expect(screen.getByRole('button',{name:'More'})).toBeDisabled();
 fireEvent.change(input,{target:{value:''}}); expect(input).toHaveValue(null); expect(screen.getByText('null')).toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'More'})); expect(input).toHaveValue(0.1);
});
it('keeps string drafts verbatim and does not mutate a controlled value rejected by its owner', async()=>{
 const onChange=vi.fn(); const view=render(<NumberInput aria-label="Draft" valueMode="string" value="01.20" onValueChange={onChange} controls decreaseLabel="Less" increaseLabel="More" step={0.1}/>);
 expect(screen.getByRole('spinbutton')).toHaveValue(1.2);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'02.30'}});expect(onChange).toHaveBeenLastCalledWith('02.30');
 await userEvent.click(screen.getByRole('button',{name:'More'}));expect(onChange).toHaveBeenLastCalledWith('1.3');expect(screen.getByRole('spinbutton')).toHaveValue(1.2);
 view.rerender(<NumberInput aria-label="Draft" valueMode="string" value="01.20" onValueChange={onChange} controls decreaseLabel="Less" increaseLabel="More" readOnly/>);
 expect(screen.getByRole('button',{name:'More'})).toBeDisabled();
});
it('keeps the legacy input-only DOM by default and disables steppers for step any',()=>{
 const view=render(<NumberInput aria-label="Value" value={null} onValueChange={()=>{}}/>);expect(screen.queryByRole('button')).not.toBeInTheDocument();
 view.rerender(<NumberInput aria-label="Value" value={1} onValueChange={()=>{}} controls increaseLabel="More" decreaseLabel="Less" step="any"/>);expect(screen.getByRole('button',{name:'More'})).toBeDisabled();
});
it('keeps loading and disabled buttons inert',async()=>{const click=vi.fn();render(<Button disabled aria-busy onClick={click}>Saving</Button>);await userEvent.click(screen.getByRole('button'));expect(click).not.toHaveBeenCalled();expect(screen.getByRole('button')).toHaveAttribute('aria-busy','true');});
it('caps count badges and exposes accessible new-content dots',()=>{render(<><Badge count={120} aria-label="120 notifications"/><Badge dot aria-label="New content"/></>);expect(screen.getByText('99+')).toBeInTheDocument();expect(screen.getByLabelText('New content')).toBeInTheDocument();});
it('keeps mixed checkbox semantics and named form submission',async()=>{render(<form aria-label="Selection"><Checkbox checked="indeterminate" name="selection" value="a" onCheckedChange={()=>{}} aria-label="Mixed"/></form>);expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked','mixed');expect(screen.getByRole('checkbox')).toHaveAttribute('data-state','indeterminate');});
it.each(['line','segmented'] as const)('retains keyboard tab activation for %s tabs',async variant=>{
 render(<Tabs defaultValue="a"><TabsList variant={variant}><TabsTrigger value="a">A</TabsTrigger><TabsTrigger value="disabled" disabled>Disabled</TabsTrigger><TabsTrigger value="b">B</TabsTrigger></TabsList><TabsContent value="a">Panel A</TabsContent><TabsContent value="b">Panel B</TabsContent></Tabs>);
 screen.getByRole('tab',{name:'A'}).focus();await userEvent.keyboard('{ArrowRight}');expect(screen.getByRole('tab',{name:'B'})).toHaveAttribute('aria-selected','true');expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B');
});
it('preserves active-page semantics and blocks disabled pagination links',async()=>{const click=vi.fn();render(<PaginationLink href="#next" disabled isActive onClick={click}>Next</PaginationLink>);const link=screen.getByRole('link');await userEvent.click(link);expect(click).not.toHaveBeenCalled();expect(link).toHaveAttribute('aria-current','page');expect(link).toHaveAttribute('tabindex','-1');});
it('retains the Select input ref and actual empty option in named forms',async()=>{
 const ref=createRef<HTMLButtonElement>();function Fixture(){const [v,set]=useState('');return <form><Select ref={ref} name="choice" label="Choice" value={v} onValueChange={set} options={[{value:'',label:'None'},{value:'a',label:'A'}]}/></form>;}
 render(<Fixture/>);expect(ref.current).toBe(screen.getByRole('combobox'));expect(document.querySelector('input[name="choice"]')).toHaveValue('');
});

it('keeps the forwarded input ref current when toggling stepper controls', () => {
 const ref=createRef<HTMLInputElement>();
 const view=render(<NumberInput ref={ref} aria-label="Quantity" value={1} onValueChange={()=>{}}/>);
 const first=ref.current;
 view.rerender(<NumberInput ref={ref} aria-label="Quantity" value={1} onValueChange={()=>{}} controls decreaseLabel="Less" increaseLabel="More"/>);
 expect(first?.isConnected).toBe(false);
 expect(ref.current).toBe(screen.getByRole('spinbutton'));
 ref.current?.focus(); expect(document.activeElement).toBe(ref.current);
 view.rerender(<NumberInput ref={ref} aria-label="Quantity" value={1} onValueChange={()=>{}}/>);
 expect(ref.current).toBe(screen.getByRole('spinbutton'));
});
