import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createReturnPathResolver } from '@niubu/core-shared';
import { ReturnPathProvider } from '@niubu/common-ui/return-path';
import { DetailFrame } from '@niubu/common-ui/detail-frame';
import { ReadState } from '@niubu/common-ui/read-state';

it('keeps two mounted common UI return bindings independent', () => {
  const navigateA = vi.fn();
  const navigateB = vi.fn();
  render(<>
    <ReturnPathProvider resolveReturnPath={createReturnPathResolver(path => path === '/a', '/a-home')}>
      <DetailFrame title="App A" returnTo="/a?tab=x" fallback="/b" onNavigate={navigateA} source="fixture" asOf="2026-10-11T00:00:00Z">A</DetailFrame>
    </ReturnPathProvider>
    <ReturnPathProvider resolveReturnPath={createReturnPathResolver(path => path === '/b', '/b-home')}>
      <DetailFrame title="App B" returnTo="/a" fallback="/b" onNavigate={navigateB} source="fixture" asOf="2026-10-11T00:00:00Z">B</DetailFrame>
    </ReturnPathProvider>
  </>);
  const buttons = screen.getAllByRole('button', { name: '返回列表' });
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  fireEvent.click(buttons[0]);
  expect(navigateA.mock.calls).toEqual([['/a?tab=x'], ['/a?tab=x']]);
  expect(navigateB.mock.calls).toEqual([['/b']]);
});

it('uses the injected app default after rejecting an unsafe fallback', () => {
  render(<ReturnPathProvider resolveReturnPath={createReturnPathResolver(path => path === '/workspace', '/workspace')}>
    <ReadState status="source-empty" fallback="https://outside.test" />
  </ReturnPathProvider>);
  expect(screen.getByRole('link', { name: '返回工作空间' })).toHaveAttribute('href', '/workspace');
});
