import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as D from '@niubu/shadcn-ui/dropdown-menu';
import * as C from '@niubu/shadcn-ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@niubu/shadcn-ui/popover';
import { BusinessPortalBoundary } from '@niubu/shadcn-ui/business-portal-boundary';

beforeAll(() => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerType = 'mouse';
      pointerId = 1;
    },
  );
});
afterAll(() => vi.unstubAllGlobals());
const variants = [
  {
    name: 'dropdown',
    Root: D.DropdownMenu,
    Trigger: D.DropdownMenuTrigger,
    Portal: D.DropdownMenuPortal,
    Content: D.DropdownMenuContent,
    Item: D.DropdownMenuItem,
    Checkbox: D.DropdownMenuCheckboxItem,
    Group: D.DropdownMenuRadioGroup,
    Radio: D.DropdownMenuRadioItem,
    Sub: D.DropdownMenuSub,
    SubTrigger: D.DropdownMenuSubTrigger,
    SubContent: D.DropdownMenuSubContent,
  },
  {
    name: 'context',
    Root: C.ContextMenu,
    Trigger: C.ContextMenuTrigger,
    Portal: C.ContextMenuPortal,
    Content: C.ContextMenuContent,
    Item: C.ContextMenuItem,
    Checkbox: C.ContextMenuCheckboxItem,
    Group: C.ContextMenuRadioGroup,
    Radio: C.ContextMenuRadioItem,
    Sub: C.ContextMenuSub,
    SubTrigger: C.ContextMenuSubTrigger,
    SubContent: C.ContextMenuSubContent,
  },
] as const;
for (const menu of variants) {
  function Example({ action }: { action: () => void }) {
    const [checked, setChecked] = useState(false);
    const [value, setValue] = useState('one');
    return (
      <BusinessPortalBoundary locked={false}>
        <menu.Root>
          <menu.Trigger asChild>
            <button>Open</button>
          </menu.Trigger>
          <menu.Portal>
            <menu.Content>
              <menu.Checkbox checked={checked} onCheckedChange={next => setChecked(next === true)}>
                Checked
              </menu.Checkbox>
              <menu.Group value={value} onValueChange={setValue}>
                <menu.Radio value="one">One</menu.Radio>
                <menu.Radio value="two">Two</menu.Radio>
              </menu.Group>
              <menu.Item disabled onSelect={action}>
                Disabled
              </menu.Item>
              <menu.Sub>
                <menu.SubTrigger>More</menu.SubTrigger>
                <menu.SubContent>
                  <menu.Item onSelect={action}>Child</menu.Item>
                </menu.SubContent>
              </menu.Sub>
            </menu.Content>
          </menu.Portal>
        </menu.Root>
      </BusinessPortalBoundary>
    );
  }
  async function open(user: ReturnType<typeof userEvent.setup>) {
    const trigger = screen.getByRole('button', { name: 'Open' });
    if (menu.name === 'context') fireEvent.contextMenu(trigger, { button: 2, clientX: 10, clientY: 10 });
    else await user.click(trigger);
  }
  it(`${menu.name} commits checkbox/radio values and blocks disabled actions`, async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    render(<Example action={action} />);
    await open(user);
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Checked' }));
    await open(user);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Checked' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'Two' }));
    await open(user);
    expect(screen.getByRole('menuitemradio', { name: 'Two' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Disabled' }));
    expect(action).not.toHaveBeenCalled();
    const submenu = screen.getByRole('menuitem', { name: 'More' });
    submenu.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Child' })).toBeVisible());
    expect(screen.getByRole('menuitem', { name: 'Child' }).closest('[data-business-portal-host]')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(action).not.toHaveBeenCalled();
  });
}
it('keeps the popover arrow and dismissal inside the business portal', async () => {
  const user = userEvent.setup();
  render(
    <BusinessPortalBoundary locked={false}>
      <Popover>
        <PopoverTrigger asChild>
          <button>Details</button>
        </PopoverTrigger>
        <PopoverContent aria-label="Details popover">
          <button>Inside</button>
        </PopoverContent>
      </Popover>
    </BusinessPortalBoundary>,
  );
  await user.click(screen.getByRole('button', { name: 'Details' }));
  const dialog = screen.getByRole('dialog', { name: 'Details popover' });
  expect(dialog.querySelector('svg')).not.toBeNull();
  expect(dialog.closest('[data-business-portal-host]')).not.toBeNull();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
});
