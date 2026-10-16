import { expect, it, vi } from 'vitest';
import { registerPendingOverlay } from './overlay-cancellation';
it('cancels only the top pending owner and honors consumed events and independent disposal', () => {
  const target = new EventTarget(),
    first = vi.fn(),
    second = vi.fn();
  const one = registerPendingOverlay(target, first),
    two = registerPendingOverlay(target, second);
  const escape = () => {
    const event = new Event('keydown', { cancelable: true }) as KeyboardEvent;
    Object.defineProperty(event, 'key', { value: 'Escape' });
    return event;
  };
  target.dispatchEvent(escape());
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  const consumed = escape();
  consumed.preventDefault();
  target.dispatchEvent(consumed);
  expect(second).toHaveBeenCalledTimes(1);
  one();
  target.dispatchEvent(escape());
  expect(second).toHaveBeenCalledTimes(2);
  two();
  target.dispatchEvent(escape());
  expect(second).toHaveBeenCalledTimes(2);
});
it('keeps targets isolated and removes the single listener after the final owner disposes', () => {
  const first = new EventTarget(),
    second = new EventTarget();
  const add = vi.spyOn(first, 'addEventListener'),
    remove = vi.spyOn(first, 'removeEventListener');
  const cancel = vi.fn(),
    other = vi.fn();
  const one = registerPendingOverlay(first, cancel),
    two = registerPendingOverlay(first, cancel),
    three = registerPendingOverlay(second, other);
  expect(add).toHaveBeenCalledTimes(1);
  one();
  expect(remove).not.toHaveBeenCalled();
  two();
  expect(remove).toHaveBeenCalledTimes(1);
  const event = new Event('keydown', { cancelable: true }) as KeyboardEvent;
  Object.defineProperty(event, 'key', { value: 'Escape' });
  first.dispatchEvent(event);
  expect(cancel).not.toHaveBeenCalled();
  second.dispatchEvent(event);
  expect(other).toHaveBeenCalledTimes(1);
  three();
});
