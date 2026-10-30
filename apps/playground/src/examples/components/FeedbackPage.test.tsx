import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import { FeedbackPage, type ExampleRecord, type FeedbackPageProps } from './FeedbackPage';

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} }));
afterAll(() => { if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); });

const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); });
function mount(props: FeedbackPageProps = {}) {
  const manager = createPreferenceManager({
    identity: { storageNamespace: 'component-demo', product: 'example', appId: 'fixture', environment: 'test', identityKey: 'synthetic' },
    storage: createStoragePort({ getItem: () => null, setItem: () => {} }),
  });
  disposers.push(() => manager.dispose());
  return render(<PreferenceProvider manager={manager}><FeedbackPage {...props} /></PreferenceProvider>);
}
function pendingSave() {
  let resolve!: () => void;
  let captured: ExampleRecord | undefined;
  let signal: AbortSignal | undefined;
  const promise = new Promise<void>(done => { resolve = done; });
  return {
    saveRecord: (record: ExampleRecord, context: { signal: AbortSignal }) => { captured = record; signal = context.signal; return promise; },
    resolve: () => resolve(),
    get captured() { return captured; },
    get signal() { return signal; },
  };
}

describe.each(['Modal', 'Drawer'] as const)('%s example composition', kind => {
  it('shares typed data through props and callbacks, updates fullscreen, and submits one form owner', async () => {
    const save = pendingSave(); mount({ saveRecord: save.saveRecord });
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    const dialog = screen.getByRole('dialog', { name: `${kind}: Ada` });
    expect(within(dialog).getByText('demo-7')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Toggle fullscreen' }));
    expect(dialog).toHaveAttribute('data-fullscreen', 'true');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update shared record' }));
    expect(screen.getByRole('dialog', { name: `${kind}: Grace` })).toBe(dialog);
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Grace');
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Name' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Lin');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save example' }));
    await waitFor(() => expect(save.captured).toEqual({ id: 'demo-7', name: 'Lin' }));
    expect(within(dialog).getByRole('button', { name: 'Save example' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Save example' })).toHaveAttribute('aria-busy', 'true');
    expect(within(dialog).getByRole('button', { name: 'Cancel example' })).toBeEnabled();
    await act(async () => { save.resolve(); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Saved record')).toHaveTextContent('demo-7 · Lin');
  });

  it('reveals and focuses both ends of long content while keeping native close handling', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    const dialog = screen.getByRole('dialog', { name: `${kind}: Ada` });
    const last = within(dialog).getByText('Synthetic content row 24');
    const scroll = vi.spyOn(last, 'scrollIntoView');
    const focus = vi.spyOn(last, 'focus');
    try {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Jump to last content row' }));
      expect((last.closest('details') as HTMLDetailsElement).open).toBe(true);
      expect(last).toHaveFocus();
      expect(scroll).toHaveBeenLastCalledWith({ block: 'start' });
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Jump to first content row' }));
      expect(within(dialog).getByText('Synthetic content row 1')).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally { scroll.mockRestore(); focus.mockRestore(); }
  });

  it('routes native form submit through the same pending gate as footer confirmation', async () => {
    const save = pendingSave(); mount({ saveRecord: save.saveRecord });
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    const form = screen.getByRole('textbox', { name: 'Name' }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(save.signal).toBeDefined());
    const originalSignal = save.signal;
    expect(screen.getByRole('button', { name: 'Save example' })).toBeDisabled();
    fireEvent.submit(form);
    expect(save.signal).toBe(originalSignal);
    expect(originalSignal?.aborted).toBe(false);
    await act(async () => { save.resolve(); });
    expect(screen.getByLabelText('Saved record')).toHaveTextContent('demo-7 · Ada');
  });

  it('keeps invalid input open and focuses the visible error', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole('button', { name: 'Save example' }));
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Saved record')).toHaveTextContent('Nothing saved');
  });

  it('cancels a pending save and remounts a fresh input without a late callback closing it', async () => {
    const save = pendingSave(); mount({ saveRecord: save.saveRecord });
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    const input = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.type(input, ' draft');
    await userEvent.click(screen.getByRole('button', { name: 'Save example' }));
    await waitFor(() => expect(save.signal).toBeDefined());
    await userEvent.click(screen.getByRole('button', { name: 'Cancel example' }));
    expect(save.signal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toBe(input);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
    await act(async () => { save.resolve(); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Saved record')).toHaveTextContent('Nothing saved');
  });

  it('aborts its save lease on page unmount', async () => {
    const save = pendingSave(); const view = mount({ saveRecord: save.saveRecord });
    await userEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Save example' }));
    await waitFor(() => expect(save.signal).toBeDefined());
    view.unmount();
    expect(save.signal?.aborted).toBe(true);
    await act(async () => { save.resolve(); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('feedback and state examples', () => {
  it('serves confirm then alert in order and reflects cancellation separately', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Queue confirmation and alert' }));
    expect(screen.getByRole('alertdialog', { name: 'Confirm sample' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: 'Queued alert' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(screen.getByRole('alertdialog', { name: 'Queued alert' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Queue result')).toHaveTextContent('Confirmed · alert completed');
    await userEvent.click(screen.getByRole('button', { name: 'Queue confirmation and alert' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog', { name: 'Queued alert' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Queue result')).toHaveTextContent('Cancelled · alert completed');
  });

  it('releases active and queued overlays when the page unmounts', async () => {
    const view = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Queue confirmation and alert' }));
    view.unmount();
    await act(async () => {});
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Queue confirmation and alert' }));
    expect(screen.getByRole('alertdialog', { name: 'Confirm sample' })).toBeInTheDocument();
  });

  it('switches read states and runs retry/reset actions', async () => {
    mount();
    expect(screen.getByLabelText('Read-state example').querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show read error' }));
    await userEvent.click(within(screen.getByLabelText('Read-state example')).getByRole('button', { name: '重新读取' }));
    expect(screen.getByLabelText('Read-state action')).toHaveTextContent('Retried');
    await userEvent.click(screen.getByRole('button', { name: 'Show empty result' }));
    await userEvent.click(within(screen.getByLabelText('Read-state example')).getByRole('button', { name: '清除筛选' }));
    expect(screen.getByLabelText('Read-state action')).toHaveTextContent('Filters reset');
  });

  it('shows distinct static 403/404/500/offline states and their local action', async () => {
    mount();
    for (const [choice, heading] of [['403', 'Access denied'], ['404', 'Page not found'], ['500', 'Server error'], ['Offline', 'Offline example']]) {
      await userEvent.click(screen.getByRole('button', { name: `Show ${choice}` }));
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Static illustration only; no network detection.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Return to sample' }));
    expect(screen.getByLabelText('State action')).toHaveTextContent('Returned to sample');
  });

  it('releases route pending and error title ownership on unmount', async () => {
    const previous = document.title; const view = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Show route pending' }));
    expect(within(screen.getByLabelText('Route pending example')).getByRole('status')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide route pending' }));
    expect(within(screen.getByLabelText('Route pending example')).queryByRole('status')).not.toBeInTheDocument();
    view.unmount();
    expect(document.title).toBe(previous);
  });
});

it('keeps a quick-view draft through its nested stay decision and returns to its opener', async () => {
  mount();
  const opener = screen.getByRole('button', { name: 'Open quick view' });
  await userEvent.click(opener);
  expect(within(screen.getByRole('dialog', { name: 'Quick view' })).getByRole('link', { name: '打开完整详情' })).toHaveAttribute('href', '/examples/feedback');
  const input = screen.getByRole('textbox', { name: 'Draft name' });
  await userEvent.clear(input);
  await userEvent.type(input, 'Grace');
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('alertdialog')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(input).toHaveValue('Grace');
  await userEvent.clear(input);
  await userEvent.type(input, 'Ada');
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Quick view' })).getByRole('button', { name: '关闭' }));
  await waitFor(() => expect(opener).toHaveFocus());
});

it('opens the public action-preview and returns focus without submitting a service request', async () => {
  mount();
  const opener = screen.getByRole('button', { name: 'Open action preview' });
  await userEvent.click(opener);
  expect(screen.getByRole('alertdialog', { name: 'Action preview' })).toHaveTextContent('demo-7');
  await userEvent.click(screen.getByRole('button', { name: '返回修改' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(opener).toHaveFocus();
});

it('demonstrates real opt-in table loading, a single error/retry, and a controlled ready result',async()=>{
 mount();const area=screen.getByRole('heading',{name:'Table loading and error feedback'}).closest('section')!;expect(within(area).getByRole('status',{name:'正在读取'})).toHaveAttribute('aria-busy','true');await userEvent.click(screen.getByRole('button',{name:'Show table error'}));expect(within(area).getAllByRole('alert')).toHaveLength(1);expect(within(area).getByRole('heading',{name:'无法读取记录'})).toBeVisible();expect(within(area).getByText('Synthetic sample data is unavailable. Please retry.')).toBeVisible();expect(within(area).queryByRole('link')).not.toBeInTheDocument();await userEvent.click(within(area).getByRole('button',{name:'重新读取'}));expect(within(area).queryByRole('alert')).not.toBeInTheDocument();expect(within(area).getByRole('status',{name:'正在读取'})).toBeVisible();await userEvent.click(screen.getByRole('button',{name:'Show table data'}));expect(within(area).getByRole('cell',{name:'Ada'})).toBeVisible();expect(within(area).queryByRole('status')).not.toBeInTheDocument();
});
