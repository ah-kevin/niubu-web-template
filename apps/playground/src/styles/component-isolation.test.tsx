import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const pageStyles = readdirSync(import.meta.dirname).filter(name=>name.endsWith('.css')).sort().map(name=>readFileSync(resolve(import.meta.dirname,name),'utf8')).join('\n');

let stylesheet: HTMLStyleElement | undefined;
afterEach(() => stylesheet?.remove());
function applyPageRules() {
  stylesheet = document.createElement('style');
  // Imports own the public component styles. This isolates only the app's extra cascade,
  // proving that adding a page wrapper never changes a primitive's existing appearance.
  stylesheet.textContent = pageStyles.replace(/^@(?:import|source)[^;]*;\s*$/gm, '');
  document.head.append(stylesheet);
}
const metrics = (element: HTMLElement) => {
  const css = getComputedStyle(element);
  return [css.paddingTop, css.paddingRight, css.borderTopWidth, css.borderTopStyle, css.borderRadius, css.width, css.opacity];
};
describe('page styling preserves public controls', () => {
  it.each(['default', 'ghost', 'outline', 'destructive'] as const)('does not overwrite the %s button when used inside a page', variant => {
    applyPageRules();
    render(<><Button variant={variant}>Outside</Button><section className="playground-page"><Button variant={variant}>Inside</Button></section></>);
    expect(metrics(screen.getByRole('button', { name: 'Inside' }))).toEqual(metrics(screen.getByRole('button', { name: 'Outside' })));
  });
  it('does not add text-input padding or borders to checkbox primitives', () => {
    applyPageRules();
    render(<><Checkbox aria-label="Outside" /><section className="playground-page"><Checkbox aria-label="Inside" /></section></>);
    expect(metrics(screen.getByRole('checkbox', { name: 'Inside' }))).toEqual(metrics(screen.getByRole('checkbox', { name: 'Outside' })));
  });
  it('keeps input appearance owned by the input component', () => {
    applyPageRules();
    render(<><Input aria-label="Outside" /><section className="playground-page"><Input aria-label="Inside" /></section></>);
    expect(metrics(screen.getByRole('textbox', { name: 'Inside' }))).toEqual(metrics(screen.getByRole('textbox', { name: 'Outside' })));
  });
});
