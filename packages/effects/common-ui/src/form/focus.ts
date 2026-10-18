import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

const pixels = (value: string | undefined) => Math.max(0, Number.parseFloat(value ?? '') || 0);
function inheritedInset(control: HTMLElement, name: string) {
  for (let node: HTMLElement | null = control; node; node = node.parentElement) {
    const value = getComputedStyle(node).getPropertyValue(name);
    if (value.trim()) return pixels(value);
  }
  return 0;
}
function revealInvalidControl(container: HTMLElement, control: HTMLElement) {
  const document = control.ownerDocument;
  const viewport = document.defaultView;
  if (!viewport) return;
  const controlRect = control.getBoundingClientRect();
  // Layoutless test environments and zero-size controls cannot provide meaningful scroll geometry.
  if (controlRect.width <= 0 || controlRect.height <= 0) return;
  const field = control.closest<HTMLElement>('.schema-field,.pattern-form-field') ?? control;
  const summary = container.querySelector<HTMLElement>('.pattern-form-error-summary');
  const root = (document.scrollingElement ?? document.documentElement) as HTMLElement;
  const layer = control.closest('[role="dialog"],[role="alertdialog"]');
  const ports: HTMLElement[] = [];
  for (let node = control.parentElement; node && node !== root; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (
      (/(auto|scroll|hidden)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) ||
      (/(auto|scroll|hidden)/.test(style.overflowX) && node.scrollWidth > node.clientWidth)
    )
      ports.push(node);
    if (node === layer) break;
  }
  // A fixed dialog owns its local scrollports; revealing its fields must never move the background document.
  if (!layer) ports.push(root);
  for (const port of ports) {
    const style = getComputedStyle(port),
      rect = port.getBoundingClientRect();
    const isDocument = port === root;
    const top = isDocument
      ? Math.max(inheritedInset(control, '--focus-reveal-inset-top'), pixels(style.scrollPaddingTop))
      : rect.top + port.clientTop + pixels(style.scrollPaddingTop);
    const bottom = isDocument
      ? viewport.innerHeight -
        Math.max(inheritedInset(control, '--focus-reveal-inset-bottom'), pixels(style.scrollPaddingBottom))
      : rect.top + port.clientTop + port.clientHeight - pixels(style.scrollPaddingBottom);
    const left = (isDocument ? 0 : rect.left + port.clientLeft) + pixels(style.scrollPaddingLeft);
    const right =
      (isDocument ? viewport.innerWidth : rect.left + port.clientLeft + port.clientWidth) -
      pixels(style.scrollPaddingRight);
    if (bottom <= top || right <= left) continue;
    const fieldRect = field.getBoundingClientRect(),
      inputRect = control.getBoundingClientRect();
    let targetTop = fieldRect.height > 0 && fieldRect.height <= bottom - top ? fieldRect.top : inputRect.top;
    let targetBottom = fieldRect.height > 0 && fieldRect.height <= bottom - top ? fieldRect.bottom : inputRect.bottom;
    let targetLeft = fieldRect.width > 0 && fieldRect.width <= right - left ? fieldRect.left : inputRect.left;
    let targetRight = fieldRect.width > 0 && fieldRect.width <= right - left ? fieldRect.right : inputRect.right;
    if (summary && (isDocument || port.contains(summary))) {
      const summaryRect = summary.getBoundingClientRect();
      if (
        summaryRect.height > 0 &&
        Math.max(targetBottom, summaryRect.bottom) - Math.min(targetTop, summaryRect.top) <= bottom - top
      ) {
        targetTop = Math.min(targetTop, summaryRect.top);
        targetBottom = Math.max(targetBottom, summaryRect.bottom);
      }
      if (
        summaryRect.width > 0 &&
        Math.max(targetRight, summaryRect.right) - Math.min(targetLeft, summaryRect.left) <= right - left
      ) {
        targetLeft = Math.min(targetLeft, summaryRect.left);
        targetRight = Math.max(targetRight, summaryRect.right);
      }
    }
    const y = targetTop < top ? targetTop - top : targetBottom > bottom ? targetBottom - bottom : 0;
    const x = targetLeft < left ? targetLeft - left : targetRight > right ? targetRight - right : 0;
    if (y) port.scrollTop += y;
    if (x) port.scrollLeft += x;
  }
}

export function focusFirstInvalidControl<T extends FieldValues>(
  container: HTMLElement,
  getFieldState: UseFormReturn<T>['getFieldState'],
) {
  const controls = container.querySelectorAll<HTMLElement>(
    'input, select, textarea, button, [tabindex], [contenteditable="true"]',
  );
  for (const control of controls) {
    const name = control.getAttribute('name') ?? control.dataset.fieldName;
    const invalid = name
      ? getFieldState(name as FieldPath<T>).invalid
      : control.getAttribute('aria-invalid') === 'true';
    if (
      !invalid ||
      control.matches(':disabled, input[type="hidden"]') ||
      control.closest('[hidden], [inert], [aria-hidden="true"]')
    )
      continue;
    let visible = true;
    for (let ancestor: HTMLElement | null = control; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
        visible = false;
        break;
      }
    }
    if (!visible) continue;
    control.focus({ preventScroll: true });
    if (control.ownerDocument.activeElement === control) {
      revealInvalidControl(container, control);
      return;
    }
  }
}
