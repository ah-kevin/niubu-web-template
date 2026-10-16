import { expect, it, vi } from 'vitest';
import { createFullscreenController } from './fullscreen';
class Doc extends EventTarget {
  fullscreenEnabled = true;
  fullscreenElement: Element | null = null;
  documentElement = {
    requestFullscreen: vi.fn(async () => {
      this.fullscreenElement = this.documentElement as unknown as Element;
      this.dispatchEvent(new Event('fullscreenchange'));
    }),
  };
  exitFullscreen = vi.fn(async () => {
    this.fullscreenElement = null;
    this.dispatchEvent(new Event('fullscreenchange'));
  });
}
it('reports actual events, rejects unsupported and never invents successful state', async () => {
  const doc = new Doc();
  const controller = createFullscreenController({ document: doc });
  const listener = vi.fn();
  controller.subscribe(listener);
  expect(controller.getSnapshot()).toMatchObject({ status: 'idle', active: false });
  await controller.toggle();
  expect(controller.getSnapshot()).toMatchObject({ status: 'idle', active: true });
  await controller.toggle();
  expect(controller.getSnapshot().active).toBe(false);
  doc.documentElement.requestFullscreen.mockRejectedValueOnce(Error('denied'));
  await controller.toggle();
  expect(controller.getSnapshot()).toMatchObject({ status: 'error', active: false });
  doc.documentElement.requestFullscreen.mockImplementationOnce(async () => {});
  await controller.toggle();
  expect(controller.getSnapshot()).toMatchObject({ status: 'error', active: false });
  doc.dispatchEvent(new Event('fullscreenerror'));
  expect(controller.getSnapshot().status).toBe('error');
  controller.dispose();
  const count = listener.mock.calls.length;
  doc.dispatchEvent(new Event('fullscreenchange'));
  expect(listener).toHaveBeenCalledTimes(count);
  const unavailable = new Doc();
  unavailable.fullscreenEnabled = false;
  const unsupported = createFullscreenController({ document: unavailable });
  expect(unsupported.getSnapshot().status).toBe('unsupported');
  await unsupported.toggle();
  unsupported.dispose();
});
it('deduplicates pending requests and ignores late completion after disposal', async () => {
  const doc = new Doc();
  let release!: () => void;
  doc.documentElement.requestFullscreen.mockImplementationOnce(() => new Promise<void>(done => (release = done)));
  const c = createFullscreenController({ document: doc });
  const first = c.toggle();
  expect(c.getSnapshot().status).toBe('pending');
  await c.toggle();
  expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  const before = c.getSnapshot();
  c.dispose();
  release();
  await first;
  expect(c.getSnapshot()).toBe(before);
  expect(doc.exitFullscreen).not.toHaveBeenCalled();
});
