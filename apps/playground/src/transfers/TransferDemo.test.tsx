import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createAuthSession } from '@niubu/stores';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../locales';
import { PlaygroundAuthProvider } from '../auth/provider';
import type { LoginInput, PlaygroundUser } from '../auth/schemas';
import { PlaygroundApiContext } from '../app/api-context';
import { createPlaygroundApi } from '../api';
import type { RequestClient, RequestOutcome, UploadProgress } from '@niubu/request';
import type { AuthContext } from '@niubu/types';
import type { TransferApi, TransferFile } from './contracts';
import { TransferDemo } from './TransferDemo';
import { RequestPage } from '../modules/request';

const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).reverse().forEach(dispose => dispose()); });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function mount(codes = ['demo:transfer'], page = false) {
  const user: PlaygroundUser = { id: 'owner', name: 'Owner', roles: [], workspaces: [{ kind: 'workspace', id: 'north' }, { kind: 'workspace', id: 'south' }] };
  let grants = codes;
  const auth = createAuthSession<PlaygroundUser, LoginInput>({ adapter: {
    restore: async () => user, login: async () => user, logout: async () => {}, refresh: async () => {},
    getCodes: async () => grants, getMenu: async () => [], credentialsProvider: () => ({ credentials: 'omit' }), invalidateLocal() {},
  }, onIdentityReset() {}, onScopeReset() {}, reload() {}, homeHref: '/', loginHref: '/login' });
  await auth.restore();
  await auth.switchScope({ kind: 'workspace', id: 'north' });
  const getContext = (): AuthContext | null => { const s = auth.getSnapshot(); return s.status === 'ready' && s.user && !s.loginExpired ? { identityKey: s.user.id, generation: s.generation, scope: s.scope } : null; };
  const disabled: RequestClient = { mode: 'disabled', async execute() { return { ok: false, error: { kind: 'not-enabled' } }; }, dispose() {} };
  const api = createPlaygroundApi(disabled, disabled, { getContext, getSessionSignal: () => auth.requestContext().signal });
  const file: TransferFile = { id: 'upload-1', name: 'picked.json', size: 32_769, contentType: 'application/json' };
  const upload = vi.fn<TransferApi['upload']>(async () => ({ ok: true, data: file }));
  const download = vi.fn<TransferApi['download']>(async () => ({ ok: true, data: { blob: new Blob(['bytes']), filename: 'server.csv', contentType: 'application/octet-stream' } }));
  api.transfers = { upload, download };
  const echo = vi.fn<typeof api.echo>(async input => ({ ok: true, data: { value: input.value, query: ['playground'], headers: {} } }));
  api.echo = echo;
  const releaseCallbacks: (() => void)[] = [];
  const ports = {
    createObjectURL: vi.fn(() => 'blob:controlled'), revokeObjectURL: vi.fn(), activate: vi.fn(),
    scheduleRelease: vi.fn((release: () => void) => { releaseCallbacks.push(release); return vi.fn(); }),
  };
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  await i18n.changeLocale(i18n.getSnapshot().preferredLocale, i18n.requiredNamespaces);
  const tree = (connected = true) => <I18nProvider instance={i18n}><PlaygroundApiContext value={connected ? api : { ...api, transfers: undefined as unknown as TransferApi }}><PlaygroundAuthProvider auth={auth}>{page ? <RequestPage /> : <TransferDemo downloadPorts={ports} />}</PlaygroundAuthProvider></PlaygroundApiContext></I18nProvider>;
  const view = render(tree());
  disposers.push(() => { auth.dispose(); i18n.dispose(); });
  return { api, auth, file, upload, download, ports, echo, view, releaseCallbacks, disconnect: () => view.rerender(tree(false)), setGrants: (next: string[]) => { grants = next; } };
}
function choose(size = 32_769) {
  const file = new File([new Uint8Array(size)], 'picked.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('演示文件'), { target: { files: [file] } });
  return file;
}

it('requires a selected file before upload', async () => {
  await mount();
  expect(screen.getByRole('heading', { name: '上传与下载' })).toBeVisible();
  expect(screen.getByRole('button', { name: '上传' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '下载文件' })).toBeDisabled();
});

it('shows server ACK bytes, keeps completing separate, and only downloads after an explicit successful-upload click', async () => {
  const f = await mount();
  const pending = deferred<RequestOutcome<TransferFile>>();
  let progress!: (value: UploadProgress) => void;
  f.upload.mockImplementationOnce((_context, _source, options) => { progress = options.onProgress!; return pending.promise; });
  const selected = choose();
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  expect(f.upload).toHaveBeenCalledOnce();
  expect(f.upload.mock.calls[0][1]).toMatchObject({ name: selected.name, size: selected.size, contentType: selected.type });
  expect(f.download).not.toHaveBeenCalled();
  expect(f.ports.createObjectURL).not.toHaveBeenCalled();
  act(() => progress({ acknowledgedBytes: 0, totalBytes: 32_769, phase: 'uploading' }));
  expect(screen.getByText('服务端已确认 0 / 32769 字节')).toBeVisible();
  act(() => progress({ acknowledgedBytes: 32_768, totalBytes: 32_769, phase: 'uploading' }));
  expect(screen.getByText('服务端已确认 32768 / 32769 字节')).toBeVisible();
  act(() => progress({ acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'uploading' }));
  expect(screen.queryByText('上传已完成')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '下载文件' })).toBeDisabled();
  act(() => progress({ acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'completing' }));
  expect(screen.getByText('字节已确认，正在完成上传')).toBeVisible();
  await act(async () => pending.resolve({ ok: true, data: f.file }));
  expect(screen.getByText('上传已完成')).toBeVisible();
  expect(screen.getByRole('button', { name: '下载文件' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
  await waitFor(() => expect(f.ports.activate).toHaveBeenCalledWith('blob:controlled', 'server.csv'));
  expect(f.download).toHaveBeenCalledWith(expect.objectContaining({ identityKey: 'owner', scope: { kind: 'workspace', id: 'north' } }), 'upload-1', expect.any(AbortSignal));
  act(() => f.releaseCallbacks[0]());
  expect(f.ports.revokeObjectURL).toHaveBeenCalledOnce();
});

it.each(['last-ack', 'completing'])('cancels during %s and ignores late success while keeping the selected File', async phase => {
  const f = await mount();
  const pending = deferred<RequestOutcome<TransferFile>>();
  let progress!: (value: UploadProgress) => void;
  f.upload.mockImplementationOnce((_context, _source, options) => { progress = options.onProgress!; return pending.promise; });
  const input = screen.getByLabelText('演示文件');
  const selected = choose();
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  act(() => progress({ acknowledgedBytes: 32_769, totalBytes: 32_769, phase: phase === 'completing' ? 'completing' : 'uploading' }));
  fireEvent.click(screen.getByRole('button', { name: '取消上传' }));
  expect(f.upload.mock.calls[0][2].signal.aborted).toBe(true);
  expect(screen.getByText('上传已停止；不能据此确认服务端已回滚。')).toBeVisible();
  await act(async () => pending.resolve({ ok: true, data: f.file }));
  expect(screen.queryByText('上传已完成')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '下载文件' })).toBeDisabled();
  expect(screen.getByLabelText('演示文件')).toBe(input);
  expect((input as HTMLInputElement).files?.[0]).toBe(selected);
});

it('does not claim an empty upload complete while complete is still pending', async () => {
  const f = await mount();
  const pending = deferred<RequestOutcome<TransferFile>>();
  f.upload.mockImplementationOnce((_context, _source, options) => {
    options.onProgress?.({ acknowledgedBytes: 0, totalBytes: 0, phase: 'completing' });
    return pending.promise;
  });
  choose(0);
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  expect(screen.getByText('字节已确认，正在完成上传')).toBeVisible();
  expect(screen.queryByText('上传已完成')).not.toBeInTheDocument();
  await act(async () => pending.resolve({ ok: false, error: { kind: 'http', status: 503 } }));
  expect(screen.getByRole('alert')).toHaveTextContent('上传失败');
  expect(screen.queryByText('上传已完成')).not.toBeInTheDocument();
});

it('aborts on scope commit, rejects late success, and never offers the old scope file id', async () => {
  const f = await mount();
  const pending = deferred<RequestOutcome<TransferFile>>();
  f.upload.mockReturnValueOnce(pending.promise);
  choose();
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  const signal = f.upload.mock.calls[0][2].signal;
  await act(async () => f.auth.switchScope({ kind: 'workspace', id: 'south' }));
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ ok: true, data: f.file }));
  expect(screen.queryByText('上传已完成')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '下载文件' })).toBeDisabled();
  expect(f.download).not.toHaveBeenCalled();
});

it('retains the same file input and selected File across same-user reauthentication while retiring old results', async () => {
  const f = await mount();
  const selected = choose();
  const input = screen.getByLabelText('演示文件');
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  await screen.findByText('上传已完成');
  act(() => f.auth.markLoginExpired());
  expect(screen.getByRole('button', { name: '上传' })).toBeDisabled();
  await act(async () => { await f.auth.login({ username: 'controlled', password: '' }, '/demo/request'); });
  expect(screen.getByLabelText('演示文件')).toBe(input);
  expect((input as HTMLInputElement).files?.[0]).toBe(selected);
  expect(screen.getByRole('button', { name: '上传' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '下载文件' })).toBeDisabled();
  expect(screen.queryByText('上传已完成')).not.toBeInTheDocument();
});

it('disables transfer actions without a grant and when the facade is disconnected', async () => {
  const f = await mount([]);
  choose();
  expect(screen.getByRole('button', { name: '上传' })).toBeDisabled();
  expect(screen.getByText('当前账号没有文件传输权限。')).toBeVisible();
  expect(f.upload).not.toHaveBeenCalled();
  f.disconnect();
  expect(screen.getByText('当前授权尚未就绪，暂不可传输。')).toBeVisible();
});

it('blocks files exceeding the explicit 1 MiB demo limit', async () => {
  const f = await mount();
  choose(1_048_577);
  expect(screen.getByText('演示文件最多 1 MiB。')).toBeVisible();
  expect(screen.getByRole('button', { name: '上传' })).toBeDisabled();
  expect(f.upload).not.toHaveBeenCalled();
});

it('requires a new explicit upload click after recovery and never creates its own second expiry alert', async () => {
  const f = await mount();
  choose();
  f.upload.mockResolvedValueOnce({ ok: false, error: { kind: 'protocol', code: 'TRANSFER_RECONFIRM' } });
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  await screen.findByText('会话已恢复，请重新确认上传；本次写入未自动重试。');
  expect(f.upload).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  await screen.findByText('上传已完成');
  expect(f.upload).toHaveBeenCalledTimes(2);
  f.upload.mockImplementationOnce(async () => { f.auth.markLoginExpired(); return { ok: false, error: { kind: 'aborted' } }; });
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '上传' })).toBeDisabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not allocate an object URL for a late download from a retired session', async () => {
  const f = await mount();
  choose();
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  await screen.findByText('上传已完成');
  const pending = deferred<Awaited<ReturnType<TransferApi['download']>>>();
  f.download.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
  await act(async () => f.auth.switchScope({ kind: 'workspace', id: 'south' }));
  expect(f.download.mock.calls[0][2]?.aborted).toBe(true);
  await act(async () => pending.resolve({ ok: true, data: { blob: new Blob(['late']), filename: 'late.csv', contentType: 'application/octet-stream' } }));
  expect(f.ports.createObjectURL).not.toHaveBeenCalled();
  expect(f.ports.activate).not.toHaveBeenCalled();
});

it('releases an earlier download before reentry and releases pending URLs on unmount idempotently', async () => {
  const f = await mount();
  choose();
  fireEvent.click(screen.getByRole('button', { name: '上传' }));
  await screen.findByText('上传已完成');
  fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
  await waitFor(() => expect(f.ports.activate).toHaveBeenCalledTimes(1));
  expect(f.ports.revokeObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
  await waitFor(() => expect(f.ports.activate).toHaveBeenCalledTimes(2));
  expect(f.ports.revokeObjectURL).toHaveBeenCalledTimes(1);
  f.view.unmount();
  expect(f.ports.revokeObjectURL).toHaveBeenCalledTimes(2);
  f.releaseCallbacks.forEach(release => release());
  expect(f.ports.revokeObjectURL).toHaveBeenCalledTimes(2);
});

it('appends transfers to RequestPage while preserving Echo input, grant and request behavior', async () => {
  const f = await mount(['demo:echo', 'demo:transfer'], true);
  expect(screen.getByRole('heading', { name: '上传与下载' })).toBeVisible();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'original echo' } });
  fireEvent.click(screen.getByRole('button', { name: '发送请求' }));
  await waitFor(() => expect(f.echo).toHaveBeenCalledWith({ value: 'original echo' }, expect.any(AbortSignal)));
  expect(await screen.findByLabelText('echo result')).toHaveTextContent('original echo');
});
