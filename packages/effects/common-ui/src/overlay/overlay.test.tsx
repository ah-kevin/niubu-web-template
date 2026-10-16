import { StrictMode, lazy, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Select } from '@niubu/shadcn-ui/select';
import { PendingOverlay } from '@niubu/shadcn-ui/pending-overlay';
import * as alertDialog from '@niubu/shadcn-ui/alert-dialog';
import { Modal } from './Modal';
import { Drawer } from './Drawer';
import { OverlayProvider } from './OverlayProvider';
import { useOverlay } from './OverlayContext';
import type { OverlayApi } from './types';

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeAll(() => { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} }); });
afterAll(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function Capture({ ready }: { ready: (api: OverlayApi) => void }) {
  const api = useOverlay();
  useEffect(() => { ready(api); }, [api, ready]);
  return null;
}

function service(strict = false) {
  let api!: OverlayApi;
  const ui = <OverlayProvider><Capture ready={value => { api = value; }} /></OverlayProvider>;
  const view = render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { ...view, get api() { return api; } };
}

describe.each([['Modal', Modal], ['Drawer', Drawer]] as const)('%s controlled shell', (_name, Component) => {
  it('associates title/description, and omits the default footer without onConfirm', () => {
    const { rerender } = render(<Component open onOpenChange={() => {}} title="编辑资料" description="填写资料"><input aria-label="姓名" /></Component>);
    expect(screen.getByRole('dialog', { name: '编辑资料', description: '填写资料' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    rerender(<Component open onOpenChange={() => {}} title="无描述">正文</Component>);
    expect(screen.getByRole('dialog', { name: '无描述' })).not.toHaveAttribute('aria-describedby');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore(); error.mockRestore();
  });

  it('requests native form submission once, keeps state controlled, and disables confirmation while loading', async () => {
    const submit = vi.fn((event: React.FormEvent) => { event.preventDefault(); });
    const change = vi.fn();
    const confirm = vi.fn(() => (document.getElementById('overlay-edit') as HTMLFormElement).requestSubmit());
    const props = { open: true, onOpenChange: change, title: '编辑', onConfirm: confirm, confirmLabel: '保存', cancelLabel: '返回' };
    const { rerender } = render(<Component {...props}><form id="overlay-edit" onSubmit={submit}><input /></form></Component>);
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(confirm).toHaveBeenCalledTimes(1); expect(submit).toHaveBeenCalledTimes(1); expect(change).not.toHaveBeenCalled();
    rerender(<Component {...props} confirmLoading><form id="overlay-edit" onSubmit={submit}><input /></form></Component>);
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存' })).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '返回' })).toBeEnabled();
  });

  it('honors custom footer including an explicitly empty footer and fills the viewport in fullscreen', () => {
    const props = { open: true, onOpenChange: () => {}, title: '全屏', onConfirm: () => {}, fullscreen: true };
    const { rerender } = render(<Component {...props} footer={<button>自定义</button>}>正文</Component>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ position: 'fixed', height: '100dvh', 'max-width': 'none', transform: 'none' });
    expect(dialog.style.width).toBe('100vw');
    expect(screen.getByRole('button', { name: '关闭' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '确定' })).not.toBeInTheDocument();
    rerender(<Component {...props} footer={null}>正文</Component>);
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  it('routes escape, outside, X and cancel exclusively through the dirty close ref without unmounting input', async () => {
    const change = vi.fn(); const close = vi.fn();
    function Editor() {
      const cancelRef = useRef<(reason: string) => void>(close);
      return <Component open onOpenChange={change} title="脏表单" onConfirm={() => {}} onRequestClose={reason => cancelRef.current(reason)}><input aria-label="输入" defaultValue="保留" /></Component>;
    }
    render(<Editor />);
    const input = screen.getByLabelText('输入');
    await userEvent.type(input, '值');
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenLastCalledWith('escape');
    fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
    fireEvent.click(document.body);
    expect(close).toHaveBeenLastCalledWith('outside');
    await userEvent.click(screen.getByRole('button', { name: '关闭' }));
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(close).toHaveBeenLastCalledWith('button');
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText('输入')).toBe(input); expect(input).toHaveValue('保留值');
  });

  it.each([false, true])('falls back to controlled close and restores the connected opening trigger strict=%s', async strict => {
    function App() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>打开</button><Component open={open} onOpenChange={setOpen} title="资料"><input /></Component></>;
    }
    render(strict ? <StrictMode><App /></StrictMode> : <App />);
    const trigger = screen.getByRole('button', { name: '打开' });
    await userEvent.click(trigger); await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels suspended content through the shared pending registry and never mounts a late result', async () => {
    const module = deferred<{ default: () => ReactNode }>();
    const Content = lazy(() => module.promise);
    function App() {
      const [open, setOpen] = useState(true);
      return <Component open={open} onOpenChange={setOpen} title="延迟内容"><Content /></Component>;
    }
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await act(async () => { module.resolve({ default: () => <p>迟到内容</p> }); });
    expect(screen.queryByText('迟到内容')).not.toBeInTheDocument();
  });
});

describe.each([false, true])('app local overlay queue strict=%s', strict => {
  it('focuses the safe cancel action for confirm and the acknowledge action for alert', async () => {
    const view = service(strict); let confirmation!: Promise<boolean>; let alert!: Promise<void>;
    act(() => { confirmation = view.api.confirm({ title: '键盘确认' }); });
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    await userEvent.keyboard('{Escape}'); await expect(confirmation).resolves.toBe(false);
    act(() => { alert = view.api.alert({ title: '键盘提示' }); });
    expect(screen.getByRole('button', { name: '确定' })).toHaveFocus();
    await userEvent.keyboard('{Enter}'); await expect(alert).resolves.toBeUndefined();
  });

  it('serves FIFO confirm/alert requests, resolves each once and remains usable', async () => {
    const view = service(strict);
    let first!: Promise<boolean>; let second!: Promise<void>; let third!: Promise<boolean>;
    act(() => { first = view.api.confirm({ title: '第一项' }); second = view.api.alert({ title: '第二项', description: '提示信息' }); third = view.api.confirm({ title: '第三项' }); });
    const firstDone = vi.fn(); void first.then(firstDone);
    expect(screen.getByRole('alertdialog', { name: '第一项' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    await expect(first).resolves.toBe(true);
    expect(screen.getByRole('alertdialog', { name: '第二项', description: '提示信息' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}'); await expect(second).resolves.toBeUndefined();
    expect(screen.getByRole('alertdialog', { name: '第三项' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    await expect(third).resolves.toBe(false); expect(firstDone).toHaveBeenCalledTimes(1);
    let again!: Promise<boolean>;
    act(() => { again = view.api.confirm({ title: '仍可使用' }); });
    await userEvent.keyboard('{Escape}'); await expect(again).resolves.toBe(false);
  });

  it('aborts active/queued/already-aborted requests without closing the following entry', async () => {
    const view = service(strict); const active = new AbortController(); const queued = new AbortController(); const before = new AbortController(); before.abort();
    let first!: Promise<boolean>; let second!: Promise<void>; let third!: Promise<boolean>;
    act(() => { first = view.api.confirm({ title: '被取消', signal: active.signal }); second = view.api.alert({ title: '排队取消', signal: queued.signal }); third = view.api.confirm({ title: '保留项' }); });
    act(() => { queued.abort(); active.abort(); });
    await expect(first).resolves.toBe(false); await expect(second).resolves.toBeUndefined();
    await expect(view.api.confirm({ title: '不应显示', signal: before.signal })).resolves.toBe(false);
    await act(async () => { await first; active.abort(); });
    expect(screen.getByRole('alertdialog', { name: '保留项' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确定' })); await expect(third).resolves.toBe(true);
  });

  it('settles active and queued promises on provider unmount and rejects no late calls', async () => {
    const view = service(strict); let one!: Promise<boolean>; let two!: Promise<void>;
    act(() => { one = view.api.confirm({ title: '确认' }); two = view.api.alert({ title: '提示' }); });
    const done = vi.fn(); void one.then(done);
    view.unmount();
    await expect(one).resolves.toBe(false); await expect(two).resolves.toBeUndefined(); expect(done).toHaveBeenCalledTimes(1);
    await expect(view.api.confirm({ title: '卸载后' })).resolves.toBe(false);
  });

  it('settles suspended service requests on unmount without mounting their eventual content', async () => {
    const view = service(strict); const module = deferred<{ default: () => ReactNode }>(); const Late = lazy(() => module.promise);
    let result!: Promise<void>;
    act(() => { result = view.api.alert({ title: <Late /> }); });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    view.unmount(); await expect(result).resolves.toBeUndefined();
    await act(async () => { module.resolve({ default: () => <span>不再挂载</span> }); });
    expect(screen.queryByText('不再挂载')).not.toBeInTheDocument();
  });
});

it('ignores a delayed onOpenChange from the previous active entry', async () => {
  const Original = alertDialog.AlertDialog;
  const callbacks: NonNullable<ComponentProps<typeof Original>['onOpenChange']>[] = [];
  const spy = vi.spyOn(alertDialog, 'AlertDialog').mockImplementation(props => {
    if (props.onOpenChange) callbacks.push(props.onOpenChange);
    return <Original {...props} />;
  });
  try {
    const view = service(); let first!: Promise<boolean>; let next!: Promise<boolean>;
    act(() => { first = view.api.confirm({ title: '旧项' }); next = view.api.confirm({ title: '下一项' }); });
    const oldClose = callbacks.at(-1)!;
    await userEvent.click(screen.getByRole('button', { name: '确定' })); await expect(first).resolves.toBe(true);
    act(() => { oldClose(false); oldClose(false); });
    expect(screen.getByRole('alertdialog', { name: '下一项' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}'); await expect(next).resolves.toBe(false);
  } finally { spy.mockRestore(); }
});

it('StrictMode effect replay keeps the API operational and cleans up effect-created requests', async () => {
  const results: Promise<boolean>[] = [];
  function Caller() {
    const api = useOverlay();
    useEffect(() => {
      const controller = new AbortController();
      results.push(api.confirm({ title: 'effect 请求', signal: controller.signal }));
      return () => controller.abort();
    }, [api]);
    return null;
  }
  render(<StrictMode><OverlayProvider><Caller /></OverlayProvider></StrictMode>);
  expect(results).toHaveLength(2); await expect(results[0]).resolves.toBe(false);
  await userEvent.click(screen.getByRole('button', { name: '确定' })); await expect(results[1]).resolves.toBe(true);
});

it('restores only a connected trigger after service completion', async () => {
  const view = service(); const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  let result!: Promise<boolean>; act(() => { result = view.api.confirm({ title: '返回焦点' }); });
  await userEvent.keyboard('{Escape}'); await result;
  await waitFor(() => expect(trigger).toHaveFocus());
  act(() => { result = view.api.confirm({ title: '触发器已移除' }); });
  trigger.remove(); const restore = vi.spyOn(trigger, 'focus');
  await userEvent.keyboard('{Escape}'); await expect(result).resolves.toBe(false);
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(restore).not.toHaveBeenCalled(); restore.mockRestore();
  expect(document.activeElement?.isConnected).toBe(true);
});

it('isolates provider instances and keeps suspended service results from closing a new entry', async () => {
  let left!: OverlayApi; let right!: OverlayApi;
  const module = deferred<{ default: () => ReactNode }>(); const Late = lazy(() => module.promise);
  render(<><OverlayProvider><Capture ready={api => { left = api; }} /></OverlayProvider><OverlayProvider><Capture ready={api => { right = api; }} /></OverlayProvider></>);
  const abort = new AbortController(); let old!: Promise<boolean>; let next!: Promise<boolean>; let other!: Promise<void>;
  act(() => { old = left.confirm({ title: <Late />, signal: abort.signal }); next = left.confirm({ title: '新项' }); });
  await userEvent.keyboard('{Escape}'); await expect(old).resolves.toBe(false);
  await act(async () => { module.resolve({ default: () => <span>旧异步项</span> }); });
  expect(screen.getByRole('alertdialog', { name: '新项' })).toBeInTheDocument();
  act(() => { other = right.alert({ title: '另一个实例' }); abort.abort(); });
  await userEvent.keyboard('{Escape}'); await expect(other).resolves.toBeUndefined();
  expect(screen.getByRole('alertdialog', { name: '新项' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}'); await expect(next).resolves.toBe(false);
});

it('Escape dismisses select, then confirm, then the pending parent, one owner at a time', async () => {
  let api!: OverlayApi; const cancelPending = vi.fn();
  function Parent() {
    const [pending, setPending] = useState(true);
    return pending ? <PendingOverlay onCancel={() => { cancelPending(); setPending(false); }} /> : null;
  }
  render(<><Parent /><OverlayProvider><Capture ready={value => { api = value; }} /></OverlayProvider></>);
  let confirmation!: Promise<boolean>;
  act(() => { confirmation = api.confirm({ title: '确认层', description: <Select label="选择项" value="a" onValueChange={() => {}} options={[{ value: 'a', label: '选项 A' }]} /> }); });
  screen.getByRole('combobox', { name: '选择项' }).focus();
  await userEvent.keyboard(' ');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(screen.getByRole('alertdialog')).toBeInTheDocument(); expect(cancelPending).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}'); await expect(confirmation).resolves.toBe(false); expect(cancelPending).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}'); expect(cancelPending).toHaveBeenCalledTimes(1);
});
