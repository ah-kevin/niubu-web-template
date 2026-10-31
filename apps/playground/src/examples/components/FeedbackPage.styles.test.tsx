import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Loading } from '@niubu/common-ui/read-state';
import { compilePlaygroundStyles, matchingRules, readCompiledRules } from '../../tests/compiled-styles';
it('consumes the real spinner token, centered region and reduced-motion styles',async()=>{
 const rules=readCompiledRules(await compilePlaygroundStyles());render(<Loading label="样式加载示例"/>);const state=screen.getByRole('status',{name:'样式加载示例'}),spinner=state.querySelector('[aria-hidden="true"]')!;
 const normal=(element:Element,property:string)=>matchingRules(rules,element,property).filter(rule=>rule.media.length===0).at(-1)?.style.getPropertyValue(property);
 expect(normal(state,'display')).toBe('flex');expect(normal(state,'align-items')).toBe('center');expect(normal(state,'min-height')).toBe('172px');expect(normal(spinner,'width')).toBe('var(--spinner-size-md)');expect(normal(spinner,'height')).toBe('var(--spinner-size-md)');expect(normal(spinner,'animation')).toContain('niubu-spinner');
 for(const element of [spinner])expect(matchingRules(rules,element,'animation').filter(rule=>rule.media.some(media=>media.includes('prefers-reduced-motion'))).at(-1)?.style.getPropertyValue('animation')).toBe('none');
});
