import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

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
    control.focus();
    if (document.activeElement === control) return;
  }
}
