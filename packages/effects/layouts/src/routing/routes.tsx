import { createElement, lazy, type ComponentType, type ReactNode } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';

export type RouteLoader = () => Promise<{ Component: ComponentType }>;
export function createRoutes(options: {
  routes: readonly { path: string }[];
  loaders: Readonly<Record<string, RouteLoader>>;
  homeHref: string;
  renderFrame(input: { path: string; registered?: ComponentType }): ReactNode;
  renderRoot(children: ReactNode): ReactNode;
  errorElement?: ReactNode;
}): RouteObject[] {
  const paths = [...new Set(options.routes.map(route => route.path))].filter(path => path !== '*');
  for (const path of Object.keys(options.loaders))
    if (!paths.includes(path)) throw Error(`Cannot mount an unregistered route: ${path}`);
  const children: RouteObject[] = paths.map(path => {
    const loader = options.loaders[path];
    const registered = loader ? lazy(async () => ({ default: (await loader()).Component })) : undefined;
    return { path, caseSensitive: true, element: options.renderFrame({ path, registered }) };
  });
  return [
    {
      // The owned outlet may be composed beside other persistent root children.
      element: options.renderRoot(createElement(Outlet, { key: 'route-outlet' })),
      errorElement: options.errorElement,
      children: [
        { index: true, element: createElement(Navigate, { to: options.homeHref, replace: true }) },
        ...children,
        { path: '*', element: options.renderFrame({ path: '*' }) },
      ],
    },
  ];
}
