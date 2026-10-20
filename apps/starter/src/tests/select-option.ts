import { fireEvent, screen } from '@testing-library/react';

/** Exercise the shared Radix Select through its keyboard and visible options. */
export async function selectOption(trigger: HTMLElement, label: string) {
  // JSDOM has no scrolling layout; Radix scrolls the focused option on open.
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: label }), { key: 'Enter' });
}
