import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BrowserFeaturesPage } from './BrowserFeaturesPage';

const restores: (() => void)[] = [];
function property(target: object, key: string, value: unknown) {
  const old = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value, writable: true });
  restores.push(() => { if (old) Object.defineProperty(target, key, old); else Reflect.deleteProperty(target, key); });
}
afterEach(() => { restores.splice(0).reverse().forEach(restore => restore()); vi.restoreAllMocks(); });

it('copies the validated synthetic configuration via the existing clipboard API', async () => {
  const writeText = vi.fn(async (_text: string) => {});
  property(navigator, 'clipboard', { writeText });
  render(<BrowserFeaturesPage />);
  fireEvent.click(await screen.findByRole('button', { name: '复制演示配置' }));
  await screen.findByText('配置已复制');
  const configuration = JSON.parse(writeText.mock.calls[0]![0]);
  expect(configuration).toMatchObject({ schemaVersion: 1, extensions: {}, core: { general: { watermark: false, watermarkText: '合成数据 · Playground' } } });
  fireEvent.click(screen.getByText('可手动复制的配置'));
  expect(screen.getByRole('textbox', { name: '可手动复制的配置' })).toHaveValue(writeText.mock.calls[0]![0]);
});

it('keeps the actual configuration available when clipboard permission fails', async () => {
  property(navigator, 'clipboard', { writeText: vi.fn(async () => { throw Error('denied'); }) });
  render(<BrowserFeaturesPage />);
  fireEvent.click(await screen.findByRole('button', { name: '复制演示配置' }));
  await screen.findByText('复制不可用，请手动复制下方配置');
  expect((screen.getByRole('textbox', { name: '可手动复制的配置' }) as HTMLTextAreaElement).value).toContain('schemaVersion');
});

it('toggles only the real document root and removes fullscreen listeners on unmount', async () => {
  property(document, 'fullscreenEnabled', true);
  property(document, 'fullscreenElement', null);
  const request = vi.fn(async () => {
    property(document, 'fullscreenElement', document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  const exit = vi.fn(async () => {
    property(document, 'fullscreenElement', null);
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  property(document.documentElement, 'requestFullscreen', request);
  property(document, 'exitFullscreen', exit);
  const add = vi.spyOn(document, 'addEventListener');
  const remove = vi.spyOn(document, 'removeEventListener');
  const view = render(<StrictMode><BrowserFeaturesPage /></StrictMode>);
  fireEvent.click(await screen.findByRole('button', { name: '切换根文档全屏' }));
  await screen.findByText('全屏状态：active');
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '切换根文档全屏' }));
  await screen.findByText('全屏状态：idle');
  expect(exit).toHaveBeenCalledTimes(1);
  view.unmount();
  for (const [type, listener] of add.mock.calls.filter(([type]) => type.startsWith('fullscreen'))) {
    expect(remove).toHaveBeenCalledWith(type, listener);
  }
});

it('reports unsupported fullscreen, renders registered icons and changes only its local text watermark', async () => {
  property(document, 'fullscreenEnabled', false);
  const view = render(<BrowserFeaturesPage />);
  expect(await screen.findByRole('button', { name: '切换根文档全屏' })).toBeDisabled();
  const registry = within(screen.getByRole('region', { name: '显式图标登记' }));
  expect(registry.getByLabelText('图标 database').tagName.toLowerCase()).toBe('svg');
  expect(registry.getByLabelText('图标 settings').tagName.toLowerCase()).toBe('svg');
  expect(registry.getByText('unknown：未登记')).toBeInTheDocument();
  expect(view.container.querySelector('.foundation-watermark')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示演示水印' }));
  fireEvent.change(screen.getByRole('textbox', { name: '演示水印文本' }), { target: { value: '本地水印' } });
  await waitFor(() => expect(view.container.querySelectorAll('.foundation-watermark span')).toHaveLength(24));
  expect(view.container.querySelector('.foundation-watermark')).toHaveTextContent('本地水印');
  fireEvent.click(screen.getByRole('checkbox', { name: '显示演示水印' }));
  expect(view.container.querySelector('.foundation-watermark')).toBeNull();
});
