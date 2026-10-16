import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUpdateChecker, type UpdateChecker, type UpdateClock } from '../../../hooks/src/check-updates';
import { CheckUpdates, type UpdateLabels } from './CheckUpdates';

const labels: UpdateLabels = {
  checking: 'Checking for updates',
  available: 'An update is available',
  unavailable: 'Cannot check for updates',
  reload: 'Refresh page',
  dirty: 'Handle unsaved changes first',
};
const owners: UpdateChecker[] = [];
const clock: UpdateClock = { setTimeout: () => 1, clearTimeout: () => {} };
function setup() {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { headers: { ETag: '"a"' } }));
  const checker = createUpdateChecker({ fetch: fetcher, indexURL: 'http://localhost:3000/base/index.html', clock });
  owners.push(checker);
  return { checker, fetcher };
}
async function available(checker: UpdateChecker, fetcher: ReturnType<typeof setup>['fetcher']) {
  await act(() => checker.check());
  fetcher.mockResolvedValueOnce(new Response(null, { headers: { ETag: '"b"' } }));
  await act(() => checker.check());
}
afterEach(() => {
  owners.splice(0).forEach(owner => owner.dispose());
  vi.restoreAllMocks();
});

describe('CheckUpdates', () => {
  it('shows an update without reloading automatically and calls the injected reload only on click', async () => {
    const { checker, fetcher } = setup();
    const onReload = vi.fn();
    render(<CheckUpdates checker={checker} dirty={false} onReload={onReload} labels={labels} />);
    await available(checker, fetcher);
    expect(screen.getByRole('status')).toHaveTextContent(labels.available);
    expect(onReload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: labels.reload }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('disables refresh for dirty state, explains it, and responds to dirty changes', async () => {
    const { checker, fetcher } = setup();
    const onReload = vi.fn();
    const view = render(<CheckUpdates checker={checker} dirty onReload={onReload} labels={labels} />);
    await available(checker, fetcher);
    const button = screen.getByRole('button', { name: labels.reload });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(labels.dirty);
    expect(screen.getByText(labels.dirty)).toBeVisible();
    fireEvent.click(button);
    expect(onReload).not.toHaveBeenCalled();
    view.rerender(<CheckUpdates checker={checker} dirty={false} onReload={onReload} labels={labels} />);
    expect(button).toBeEnabled();
    expect(screen.queryByText(labels.dirty)).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('lets the Main callback re-read live dirty rather than bypassing its guard', async () => {
    const { checker, fetcher } = setup();
    let liveDirty = false;
    const reload = vi.fn();
    const onReload = () => {
      if (!liveDirty) reload();
    };
    render(<CheckUpdates checker={checker} dirty={false} onReload={onReload} labels={labels} />);
    await available(checker, fetcher);
    liveDirty = true;
    fireEvent.click(screen.getByRole('button', { name: labels.reload }));
    expect(reload).not.toHaveBeenCalled();
    liveDirty = false;
    fireEvent.click(screen.getByRole('button', { name: labels.reload }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('displays checking and unavailable honestly, then recovers without an update prompt', async () => {
    const { checker, fetcher } = setup();
    let reject!: (error: Error) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>((_resolve, no) => { reject = no; }));
    render(<CheckUpdates checker={checker} dirty={false} onReload={() => {}} labels={labels} />);
    expect(screen.getByRole('status')).toHaveTextContent(labels.checking);
    await act(async () => {
      reject(new Error('offline'));
      await checker.check();
    });
    expect(screen.getByRole('status')).toHaveTextContent(labels.unavailable);
    expect(screen.queryByRole('button', { name: labels.reload })).not.toBeInTheDocument();
    await act(() => checker.check());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('preserves one update status and refresh button through repeated checks and later network errors', async () => {
    const { checker, fetcher } = setup();
    render(<CheckUpdates checker={checker} dirty={false} onReload={() => {}} labels={labels} />);
    await available(checker, fetcher);
    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: labels.reload });
    fetcher.mockResolvedValueOnce(new Response(null, { headers: { ETag: '"b"' } }));
    await act(() => checker.check());
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await act(() => checker.check());
    expect(screen.getByRole('status')).toBe(status);
    expect(screen.getByRole('button', { name: labels.reload })).toBe(button);
    expect(screen.getByRole('status')).toHaveTextContent(labels.available);
    expect(screen.getByRole('status')).toHaveTextContent(labels.unavailable);
  });

  it('binds visibility, aborts on hide/unmount and cleans its own listener under StrictMode', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const { checker, fetcher } = setup();
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const view = render(<StrictMode><CheckUpdates checker={checker} dirty={false} onReload={() => {}} labels={labels} /></StrictMode>);
    await act(() => checker.check());
    const count = fetcher.mock.calls.length;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(() => checker.check());
    expect(fetcher).toHaveBeenCalledTimes(count);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(() => checker.check());
    expect(fetcher).toHaveBeenCalledTimes(count + 1);
    view.unmount();
    const registrations = add.mock.calls.filter(([type]) => type === 'visibilitychange');
    const removals = remove.mock.calls.filter(([type]) => type === 'visibilitychange');
    expect(registrations.length).toBeGreaterThan(0);
    for (const registration of registrations) expect(removals).toContainEqual(registration);
    document.dispatchEvent(new Event('visibilitychange'));
    await checker.check();
    expect(fetcher).toHaveBeenCalledTimes(count + 1);
  });
});
