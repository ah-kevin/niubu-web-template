import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { focusFirstInvalidControl } from './focus';

const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
const root = (document.scrollingElement ?? document.documentElement) as HTMLElement;
const state = () => ({ invalid: true, isDirty: false, isTouched: false, isValidating: false });
beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  root.scrollTop = 0; root.scrollLeft = 0;
});
afterEach(() => {
  document.body.replaceChildren(); root.scrollTop = 0; root.scrollLeft = 0; root.removeAttribute('style');
  if (height) Object.defineProperty(window, 'innerHeight', height);
  if (width) Object.defineProperty(window, 'innerWidth', width);
});
function fixture(summary = false) {
  const shell = document.createElement('div');
  shell.style.setProperty('--focus-reveal-inset-top', '88px');
  shell.innerHTML = `<form>${summary ? '<div class="pattern-form-error-summary" role="alert">Fix errors</div>' : ''}<div class="schema-field"><label for="invalid">Source</label><input type="hidden" name="source"><button id="invalid" type="button" name="source" aria-invalid="true">Choose source</button><p>Source is required</p></div></form>`;
  document.body.append(shell);
  return { shell, form: shell.querySelector('form')!, field: shell.querySelector<HTMLElement>('.schema-field')!, control: shell.querySelector<HTMLButtonElement>('button')!, summary: shell.querySelector<HTMLElement>('[role=alert]') };
}
function documentBox(element: HTMLElement, top: number, size: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => new DOMRect(16, top - root.scrollTop, 343, size));
}
it('reveals the N01 first field, its label/error and fitting summary below fixed header and tabs without a second native scroll', () => {
  const f = fixture(true);
  root.scrollTop = 364.5; root.style.scrollPaddingTop = '88px';
  documentBox(f.summary!, 188.6875, 85.1875);
  documentBox(f.field, 337.875, 89.296875);
  documentBox(f.control, 364.2734375, 32);
  const focus = vi.spyOn(f.control, 'focus');
  focusFirstInvalidControl(f.form, state);
  expect(document.activeElement).toBe(f.control);
  expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(f.summary!.getBoundingClientRect().top).toBeCloseTo(88);
  expect(f.field.getBoundingClientRect().top).toBeGreaterThanOrEqual(88);
  expect(f.field.getBoundingClientRect().bottom).toBeLessThanOrEqual(812);
  expect(root.scrollTop).toBeCloseTo(100.6875);
});
it('respects the fixed footer and existing scroll padding without adding duplicate inset', () => {
  const f = fixture();
  f.shell.style.setProperty('--focus-reveal-inset-bottom', '32px');
  root.style.scrollPaddingBottom = '64px';
  documentBox(f.field, 790, 80); documentBox(f.control, 812, 32);
  focusFirstInvalidControl(f.form, state);
  expect(f.field.getBoundingClientRect().bottom).toBe(748);
  expect(root.scrollTop).toBe(122);
});
it('reveals within a dialog scrollport without moving the document or applying document chrome inset', () => {
  const f = fixture();
  const dialog = document.createElement('section'); dialog.setAttribute('role', 'dialog');
  const port = document.createElement('div'); port.style.overflowY = 'auto';
  Object.defineProperty(port, 'clientHeight', { configurable: true, value: 300 });
  Object.defineProperty(port, 'scrollHeight', { configurable: true, value: 900 });
  Object.defineProperty(port, 'clientWidth', { configurable: true, value: 343 });
  port.scrollTop = 300; root.scrollTop = 100;
  dialog.append(port); f.shell.append(dialog); port.append(f.form);
  vi.spyOn(port, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 100, 343, 300));
  vi.spyOn(f.field, 'getBoundingClientRect').mockImplementation(() => new DOMRect(16, 750 - port.scrollTop, 343, 80));
  vi.spyOn(f.control, 'getBoundingClientRect').mockImplementation(() => new DOMRect(16, 772 - port.scrollTop, 343, 32));
  focusFirstInvalidControl(f.form, state);
  expect(f.field.getBoundingClientRect().bottom).toBe(400);
  expect(port.scrollTop).toBe(430);
  expect(root.scrollTop).toBe(100);
});
it('keeps an already visible field in place and does not manufacture scroll from zero-size jsdom boxes', () => {
  const f = fixture();
  documentBox(f.field, 200, 80); documentBox(f.control, 222, 32);
  focusFirstInvalidControl(f.form, state);
  expect(document.activeElement).toBe(f.control); expect(root.scrollTop).toBe(0);
  vi.mocked(f.field.getBoundingClientRect).mockReturnValue(new DOMRect());
  vi.mocked(f.control.getBoundingClientRect).mockReturnValue(new DOMRect());
  root.scrollTop = 120;
  focusFirstInvalidControl(f.form, state);
  expect(root.scrollTop).toBe(120);
});
it('prioritizes the first field when a distant summary cannot fit and retains native hidden/disabled skipping', () => {
  const f = fixture(true);
  f.form.insertAdjacentHTML('afterbegin', '<button name="disabled" disabled>Disabled</button><div hidden><input name="hidden"></div>');
  documentBox(f.summary!, 100, 80); documentBox(f.field, 1000, 80); documentBox(f.control, 1022, 32);
  focusFirstInvalidControl(f.form, state);
  expect(document.activeElement).toBe(f.control);
  expect(root.scrollTop).toBe(268);
  expect(f.field.getBoundingClientRect().bottom).toBe(812);
});
it('keeps horizontal reveal when preventing the browser default focus scroll', () => {
  const f = fixture(); root.scrollLeft = 0;
  vi.spyOn(f.field, 'getBoundingClientRect').mockImplementation(() => new DOMRect(16 - root.scrollLeft, 200, 900, 80));
  vi.spyOn(f.control, 'getBoundingClientRect').mockImplementation(() => new DOMRect(600 - root.scrollLeft, 222, 100, 32));
  focusFirstInvalidControl(f.form, state);
  expect(f.control.getBoundingClientRect().right).toBe(375);
  expect(root.scrollLeft).toBe(325);
  root.scrollLeft = 0;
});
