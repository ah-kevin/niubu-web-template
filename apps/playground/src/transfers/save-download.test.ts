import { expect, it, vi } from 'vitest';
import { saveDownload } from './save-download';

function fixture() {
  let scheduled!: () => void;
  const cancel = vi.fn();
  const ports = {
    createObjectURL: vi.fn(() => 'blob:controlled'),
    revokeObjectURL: vi.fn(),
    activate: vi.fn(),
    scheduleRelease: vi.fn((release: () => void) => { scheduled = release; return cancel; }),
  };
  const file = { blob: new Blob(['file']), filename: 'safe.csv', contentType: 'text/csv' };
  return { ports, file, cancel, releaseScheduled: () => scheduled() };
}

it('activates with the decoded filename and releases the exact object URL on the next schedule', () => {
  const f = fixture();
  saveDownload(f.file, f.ports);
  expect(f.ports.createObjectURL).toHaveBeenCalledWith(f.file.blob);
  expect(f.ports.activate).toHaveBeenCalledWith('blob:controlled', 'safe.csv');
  expect(f.ports.revokeObjectURL).not.toHaveBeenCalled();
  f.releaseScheduled();
  expect(f.ports.revokeObjectURL).toHaveBeenCalledWith('blob:controlled');
});

it('returns an idempotent cleanup and cancels the pending scheduled release', () => {
  const f = fixture();
  const release = saveDownload(f.file, f.ports);
  release();
  release();
  f.releaseScheduled();
  expect(f.cancel).toHaveBeenCalledOnce();
  expect(f.ports.revokeObjectURL).toHaveBeenCalledOnce();
});

it.each(['activate', 'scheduleRelease'] as const)('releases the object URL if %s throws', stage => {
  const f = fixture();
  f.ports[stage].mockImplementationOnce(() => { throw Error('unavailable'); });
  expect(() => saveDownload(f.file, f.ports)).toThrow('unavailable');
  expect(f.ports.revokeObjectURL).toHaveBeenCalledOnce();
});

it('handles a scheduler that releases synchronously without retaining its cancellation handle', () => {
  const f = fixture();
  f.ports.scheduleRelease.mockImplementation(release => { release(); return f.cancel; });
  const release = saveDownload(f.file, f.ports);
  release();
  expect(f.cancel).toHaveBeenCalledOnce();
  expect(f.ports.revokeObjectURL).toHaveBeenCalledOnce();
});
