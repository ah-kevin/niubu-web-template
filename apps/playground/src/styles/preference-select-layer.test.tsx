import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it } from 'vitest';
import { Select } from '@niubu/shadcn-ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@niubu/shadcn-ui/sheet';
import {
  compilePlaygroundStyles,
  matchingRules,
  readCompiledRules,
  type CompiledStyleRule,
} from '../tests/compiled-styles';

let rules: CompiledStyleRule[];
beforeAll(async () => {
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
  rules = readCompiledRules(await compilePlaygroundStyles());
});

function Fixture() {
  const [value, setValue] = useState('standard');
  return (
    <Sheet open>
      <SheetContent className="preference-drawer">
        <SheetTitle>Preferences</SheetTitle>
        <SheetDescription>Choose a density</SheetDescription>
        <Select
          label="Density"
          value={value}
          onValueChange={setValue}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </SheetContent>
    </Sheet>
  );
}

function layer(element: Element) {
  // Shell content opts out of conditional body utilities, so its unconditional layer must stand alone.
  const value =
    matchingRules(rules, element, 'z-index')
      .filter(rule => rule.media.length === 0 && rule.selector.startsWith('.z-'))
      .at(-1)
      ?.style.getPropertyValue('z-index') ?? '';
  const variable = value.match(/^var\((--[\w-]+)\)$/)?.[1];
  return Number(
    variable
      ? matchingRules(rules, document.documentElement, variable).at(-1)?.style.getPropertyValue(variable)
      : value,
  );
}

it('keeps preference Select options above both the drawer and its pointer-blocking overlay', async () => {
  render(<Fixture />);
  const trigger = screen.getByRole('combobox', { name: 'Density' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const list = await screen.findByRole('listbox');
  expect(list).toHaveAttribute('data-control-shell');
  expect(layer(list)).toBeGreaterThan(layer(document.querySelector('[data-slot="sheet-content"]')!));
  expect(layer(list)).toBeGreaterThan(layer(document.querySelector('[data-slot="sheet-overlay"]')!));
  fireEvent.click(screen.getByRole('option', { name: 'Compact' }));
  expect(trigger).toHaveTextContent('Compact');
});
