import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks';
import { RoutePresentation, createRouteMatcher } from './index';

afterEach(cleanup);
it('derives the document title from app input and honors the dynamic-title preference', () => {
  const manager = createPreferenceManager({ identity: { storageNamespace: 'template', product: 'example', appId: 'fixture', environment: 'test', identityKey: 'one' }, storage: createStoragePort({ getItem: () => null, setItem: () => {} }) });
  const previous = document.title;
  const view = render(<PreferenceProvider manager={manager}><RoutePresentation title="Record" appTitle="Example Console" generation="one"><h1>Record</h1></RoutePresentation></PreferenceProvider>);
  expect(screen.getByRole('heading', { name: 'Record' })).toBeVisible();
  expect(document.title).toBe('Record · Example Console');
  act(() => { manager.update({ general: { dynamicTitle: false } }); });
  expect(document.title).toBe('Example Console');
  view.unmount();
  expect(document.title).toBe(previous);
  manager.dispose();
});

it('matches static routes before parameters and rejects malformed or unsupported entity addresses', () => {
  const shared = { scope: 'public', capability: null, titleKey: 'record', iconToken: 'File', order: 1, navigation: true } as const;
  const routes = [{ ...shared, id: 'detail', path: '/records/:id' }, { ...shared, id: 'new', path: '/records/new' }];
  const find = createRouteMatcher(routes, id => /^[a-z][a-z0-9-]*$/.test(id));
  expect(find('/records/new')?.id).toBe('new');
  expect(find('/records/r1')?.id).toBe('detail');
  expect(find('/records/%2F')).toBeNull();
  expect(find('/records/%zz')).toBeNull();
});
