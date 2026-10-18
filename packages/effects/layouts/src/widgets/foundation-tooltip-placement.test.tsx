import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Tooltip } from '@niubu/shadcn-ui/preference-primitives';
import { renderWidgets } from './widget-test-utils';

afterEach(() => vi.unstubAllGlobals());

it('uses the upstream vertical tooltip placement for neighboring header tools instead of covering the next launcher', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  await renderWidgets(
    <div>
      <Tooltip content="Theme explanation">
        <button>Theme launcher</button>
      </Tooltip>
      <button>Language launcher</button>
    </div>,
  );
  act(() => screen.getByRole('button', { name: 'Theme launcher' }).focus());
  const tooltip = await screen.findByRole('tooltip');
  await waitFor(() => expect(tooltip).toHaveAttribute('data-side', 'top'));
  expect(tooltip).toHaveTextContent('Theme explanation');
  expect(screen.getByRole('button', { name: 'Language launcher' })).toBeEnabled();
});
