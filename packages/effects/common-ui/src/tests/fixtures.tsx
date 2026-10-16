import type { ReactNode } from 'react';
import { render as renderUi, type RenderOptions } from '@testing-library/react';
import { createReturnPathResolver } from '@niubu/core-shared';
import { ReturnPathProvider } from '@niubu/common-ui/return-path';

const resolver = createReturnPathResolver(path => path === '/overview' || path === '/sales/orders' || /^\/sales\/orders\/order[-.A-Za-z0-9_~]+$/.test(path), '/overview');
export function render(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
  return renderUi(ui, { ...options, wrapper: ({ children }) => <ReturnPathProvider resolveReturnPath={resolver}>{children}</ReturnPathProvider> });
}
