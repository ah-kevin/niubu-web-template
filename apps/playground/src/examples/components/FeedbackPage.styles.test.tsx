import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Loading } from '@niubu/common-ui/read-state';
import { compilePlaygroundStyles, matchingRules, readCompiledRules } from '../../tests/compiled-styles';
it('consumes the real four-dot size, centered region and reduced-motion styles',async()=>{
 const rules=readCompiledRules(await compilePlaygroundStyles());render(<Loading label="样式加载示例"/>);const state=screen.getByRole('status',{name:'样式加载示例'}),dots=state.querySelector('[aria-hidden="true"]')!,dot=dots.children[0]!;
 const normal=(element:Element,property:string)=>matchingRules(rules,element,property).filter(rule=>rule.media.length===0).at(-1)?.style.getPropertyValue(property);
 expect(normal(state,'display')).toBe('flex');expect(normal(state,'align-items')).toBe('center');expect(normal(state,'min-height')).toBe('172px');expect(normal(dots,'width')).toBe('36px');expect(normal(dots,'height')).toBe('36px');expect(normal(dot,'width')).toBe('16px');expect(normal(dot,'height')).toBe('16px');expect(normal(dots,'animation')).toContain('niubu-loading-rotate');
 for(const element of [dots,dot])expect(matchingRules(rules,element,'animation').filter(rule=>rule.media.some(media=>media.includes('prefers-reduced-motion'))).at(-1)?.style.getPropertyValue('animation')).toBe('none');
});
